"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/is-uuid";

export type QualificationDetailsInput = {
  flight_mode: string;
  departure_city: string;
  travelers_adults: string;
  travelers_children: string;
  children_ages: string;
  room_distribution: string;
  accommodation: string;
  budget_min: string;
  budget_max: string;
  budget_unit: string;
  currency: string;
  budget_includes_flights: string;
  travel_period: string;
  arrival_details: string;
  departure_details: string;
  duration: string;
  itinerary: string;
  services: string;
  constraints: string;
  expedition_water: string;
  expedition_shelter: string;
};

const INPUT_FIELDS: (keyof QualificationDetailsInput)[] = [
  'flight_mode', 'departure_city', 'travelers_adults', 'travelers_children', 'children_ages',
  'room_distribution', 'accommodation', 'budget_min', 'budget_max', 'budget_unit', 'currency',
  'budget_includes_flights', 'travel_period', 'arrival_details', 'departure_details', 'duration',
  'itinerary', 'services', 'constraints', 'expedition_water', 'expedition_shelter',
];

export async function saveQualificationDetails(leadId: string, input: QualificationDetailsInput) {
  if (!isUuid(leadId)) return { ok: false as const, error: "Dossier invalide." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Non authentifié." };
  if (!input || typeof input !== 'object' || Array.isArray(input) || INPUT_FIELDS.some(key => typeof input[key] !== "string" || input[key].length > 5000)) {
    return { ok: false as const, error: "Précisions invalides ou trop longues." };
  }
  const count = (value: string) => value.trim() === "" ? null : Number(value);
  const adults = count(input.travelers_adults);
  const children = count(input.travelers_children);
  if ([adults, children].some(value => value !== null && (!Number.isInteger(value) || value < 0 || value > 1000))) {
    return { ok: false as const, error: "Indiquez un nombre entier positif pour les participants." };
  }
  if (adults === 0 && children === 0) return { ok: false as const, error: "Le groupe doit contenir au moins un participant." };
  const budgetMin = count(input.budget_min);
  const budgetMax = count(input.budget_max);
  if ([budgetMin, budgetMax].some(value => value !== null && (!Number.isFinite(value) || value <= 0))) {
    return { ok: false as const, error: "Le budget doit être un montant positif." };
  }
  if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
    return { ok: false as const, error: "Le budget maximum doit être supérieur ou égal au budget indicatif." };
  }
  if (!['', 'included', 'excluded', 'booked'].includes(input.flight_mode) || !['', 'per_person', 'total'].includes(input.budget_unit) || !['', 'yes', 'no'].includes(input.budget_includes_flights) || (input.currency !== '' && !/^[A-Z]{3}$/.test(input.currency))) {
    return { ok: false as const, error: "Vérifiez les vols, la devise et la base du budget." };
  }
  const { data: lead, error: loadError } = await supabase.from('leads').select('id,intake_payload,updated_at,referent_id,deleted_at,travel_period,trip_dates,travel_start_date,travel_end_date').eq('id', leadId).maybeSingle();
  if (loadError || !lead) return { ok: false as const, error: "Dossier introuvable ou inaccessible." };
  if (lead.deleted_at) return { ok: false as const, error: "Ce dossier est archivé." };
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profileError || !profile || !['admin', 'lead_referent'].includes(profile.role)) {
    return { ok: false as const, error: "Vous n’êtes pas autorisé à qualifier les dossiers." };
  }
  if (lead.referent_id && lead.referent_id !== user.id && profile.role !== 'admin') {
    return { ok: false as const, error: "Seul le référent assigné ou un administrateur peut modifier ces précisions." };
  }
  const payload = lead.intake_payload && typeof lead.intake_payload === 'object' ? lead.intake_payload : {};
  const previousFacts = payload.qualification_facts && typeof payload.qualification_facts === 'object' ? payload.qualification_facts : {};
  const imported = payload.manual_qualification && typeof payload.manual_qualification === 'object' ? payload.manual_qualification : {};
  const previousPeriod = Object.prototype.hasOwnProperty.call(previousFacts, 'travel_period')
    ? previousFacts.travel_period : imported.flex_period || payload.flex_period || lead.travel_period || lead.trip_dates;
  const period = input.travel_period.trim();
  const facts = {
    ...previousFacts,
    flight_mode: input.flight_mode || null,
    departure_city: input.departure_city.trim() || null,
    travelers_adults: adults,
    travelers_children: children,
    children_ages: input.children_ages.trim() || null,
    room_distribution: input.room_distribution.trim() || null,
    accommodation: input.accommodation.trim() || null,
    budget_includes_flights: input.budget_includes_flights === '' ? null : input.budget_includes_flights === 'yes',
    arrival_details: input.arrival_details.trim() || null,
    departure_details: input.departure_details.trim() || null,
    duration: input.duration.trim() || null,
    itinerary: input.itinerary.trim() || null,
    services: input.services.trim() || null,
    constraints: input.constraints.trim() || null,
    expedition_water: input.expedition_water.trim() || null,
    expedition_shelter: input.expedition_shelter.trim() || null,
    budget_min: budgetMin,
    budget_max: budgetMax,
    budget_unit: input.budget_unit || null,
    currency: input.currency || null,
    travel_period: period || null,
    updated_at: new Date().toISOString(),
    confirmed_by: user.id,
  };
  const updates: Record<string, unknown> = {
    intake_payload: {
      ...payload, qualification_facts: facts,
      currency: input.currency,
      budget_ideal: input.budget_min.trim(), budget_max: input.budget_max.trim(), budget_unit: input.budget_unit,
      ...(Object.keys(imported).length ? { manual_qualification: {
        ...imported, currency: input.currency,
        budget_ideal: input.budget_min.trim(), budget_max: input.budget_max.trim(), budget_unit: input.budget_unit,
      } } : {}),
    },
    budget_min: input.currency === 'EUR' ? budgetMin : null,
    budget_max: input.currency === 'EUR' ? budgetMax : null,
    budget_unit: input.budget_unit || null,
    currency: 'EUR',
  };
  // Like the other BO3 actions, this explicit save assigns an unclaimed file
  // to its operator. Claim and edit are one guarded write, so a concurrent
  // assignment cannot leave the details attached to somebody else's dossier.
  if (!lead.referent_id) {
    updates.referent_id = user.id;
    updates.referent_assigned_at = new Date().toISOString();
  }
  // Saving another logistics field must not collapse the original date wording
  // into one field or change a structured range. An edited free-form period
  // replaces the previous dates, rather than leaving stale exact dates as proof.
  if (period !== (typeof previousPeriod === 'string' ? previousPeriod.trim() : '')) {
    updates.travel_period = period || null;
    updates.trip_dates = period;
    updates.travel_start_date = null;
    updates.travel_end_date = null;
    (updates.intake_payload as Record<string, unknown>).date_start = '';
    (updates.intake_payload as Record<string, unknown>).date_end = '';
    (updates.intake_payload as Record<string, unknown>).flex_period = period;
    (updates.intake_payload as Record<string, unknown>).flex_month = period;
    if (Object.keys(imported).length) (updates.intake_payload as Record<string, unknown>).manual_qualification = {
      ...(updates.intake_payload as Record<string, unknown>).manual_qualification as Record<string, unknown>,
      date_start: '', date_end: '', flex_period: period,
    };
  }
  if (adults !== null) updates.travelers_adults = adults;
  if (children !== null) updates.travelers_children = children;
  if (adults !== null && children !== null) updates.travelers = `${adults} adulte${adults > 1 ? 's' : ''}, ${children} enfant${children > 1 ? 's' : ''}`;
  if (adults !== null && children !== null) (updates.intake_payload as Record<string, unknown>).travellers_count = adults + children;
  updates.budget = budgetMin !== null || budgetMax !== null
    ? `${budgetMin ?? budgetMax}${budgetMax !== null && budgetMin !== null && budgetMax !== budgetMin ? `–${budgetMax}` : ''} ${input.currency || 'devise à confirmer'}${input.budget_unit === 'per_person' ? ' / personne' : input.budget_unit === 'total' ? ' pour le groupe' : ' — base à préciser'}`
    : '';
  let update = supabase.from('leads').update(updates).eq('id', leadId).eq('updated_at', lead.updated_at);
  update = lead.referent_id ? update.eq('referent_id', lead.referent_id) : update.is('referent_id', null);
  const { data: saved, error } = await update.select('id').maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!saved) return { ok: false as const, error: "Le dossier a été modifié entre-temps. Rechargez la fiche avant de réessayer." };
  await supabase.from('activities').insert({ lead_id: leadId, actor_id: user.id, kind: 'qualification_details_saved', detail: `Vols, groupe, chambres et précisions de chiffrage mis à jour par l’opérateur.${lead.referent_id ? '' : ' Dossier pris en charge par cet opérateur.'}` });
  for (const path of [`/leads/${leadId}`, '/leads', '/inbox', '/dashboard']) revalidatePath(path);
  return { ok: true as const };
}
