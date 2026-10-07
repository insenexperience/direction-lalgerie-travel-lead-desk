"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveQualificationDetails, type QualificationDetailsInput } from '@/app/(dashboard)/leads/qualification-details-actions';
import type { SupabaseLeadRow } from '@/lib/supabase-lead-row';
import { analyzeLeadQualification } from '@/lib/lead-qualification-completeness';

export function LeadLogisticsEditor({ lead }: { lead: SupabaseLeadRow }) {
  const router = useRouter();
  const payload = lead.intake_payload ?? {};
  const facts = (payload.qualification_facts ?? {}) as Record<string, unknown>;
  const imported = (payload.manual_qualification ?? {}) as Record<string, unknown>;
  const str = (value: unknown) => value == null ? '' : Array.isArray(value) ? value.join(', ') : String(value);
  const recorded = (key: string, fallback: unknown) => Object.prototype.hasOwnProperty.call(facts, key) ? facts[key] : fallback;
  // The financial column defaults to EUR even when the traveler has never
  // supplied a currency. Only a recorded currency or an actual legacy EUR
  // amount can prefill this choice; an explicit unknown must stay unknown.
  const currency = str(recorded('currency', Object.prototype.hasOwnProperty.call(imported, 'currency')
    ? imported.currency : Object.prototype.hasOwnProperty.call(payload, 'currency')
      ? payload.currency : lead.budget_min != null || lead.budget_max != null ? lead.currency : ''));
  const travelPeriod = str(recorded('travel_period', str(imported.flex_period) || str(payload.flex_period) || lead.travel_period || lead.trip_dates));
  const [values, setValues] = useState<QualificationDetailsInput>({
    flight_mode: str(facts.flight_mode ?? imported.flights),
    departure_city: str(facts.departure_city ?? imported.departure_airport),
    travelers_adults: str(facts.travelers_adults ?? imported.travelers_adults),
    travelers_children: str(facts.travelers_children ?? imported.travelers_children),
    children_ages: str(facts.children_ages ?? imported.children_ages),
    room_distribution: str(facts.room_distribution ?? imported.rooms),
    accommodation: str(facts.accommodation ?? imported.hebergements),
    budget_min: str(recorded('budget_min', facts.budget_amount ?? imported.budget_ideal ?? payload.budget_ideal ?? lead.budget_min)),
    budget_max: str(recorded('budget_max', imported.budget_max ?? payload.budget_max ?? lead.budget_max)),
    budget_unit: str(recorded('budget_unit', imported.budget_unit ?? payload.budget_unit ?? lead.budget_unit)), currency,
    budget_includes_flights: facts.budget_includes_flights === true ? 'yes' : facts.budget_includes_flights === false ? 'no' : '',
    travel_period: travelPeriod,
    arrival_details: str(facts.arrival_details ?? imported.arrival_details),
    departure_details: str(facts.departure_details ?? imported.departure_details),
    duration: str(facts.duration ?? imported.flex_duration),
    itinerary: str(facts.itinerary ?? lead.destination_main),
    services: str(facts.services), constraints: str(facts.constraints ?? imported.constraints),
    expedition_water: str(facts.expedition_water), expedition_shelter: str(facts.expedition_shelter),
  });
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof QualificationDetailsInput, value: string) => { setValues(v => ({ ...v, [key]: value })); setMessage(null); };
  const controlClass = 'mt-1.5 w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-steel focus:outline-none focus:ring-2 focus:ring-steel/20';
  const field = (key: keyof QualificationDetailsInput, label: string, placeholder = '', type = 'text') => (
    <label className="block text-sm text-foreground" key={key}>{label}<input type={type} min={type === 'number' ? 0 : undefined} value={values[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} className={controlClass} /></label>
  );
  return (
    <details className="rounded-lg border border-border bg-panel">
      <summary className="cursor-pointer px-4 py-4 font-semibold text-steel">Compléter les informations pour le brief agence</summary>
      <form className="space-y-6 border-t border-border p-4 sm:p-5" onSubmit={e => {
        e.preventDefault(); setError(null); setMessage(null);
        startTransition(async () => { const result = await saveQualificationDetails(lead.id, values); if (!result.ok) setError(result.error); else { setMessage('Précisions enregistrées. Les questions du mail sont actualisées.'); router.refresh(); } });
      }}>
        <p className="text-sm leading-relaxed text-muted-foreground">Renseignez les réponses du client ici. Laissez les informations inconnues vides : elles apparaîtront dans le mail de qualification.</p>
        <fieldset className="space-y-3"><legend className="mb-3 font-semibold text-steel">Vols</legend><div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Prise en charge des vols<select value={values.flight_mode} onChange={e => set('flight_mode', e.target.value)} className={controlClass}><option value="">À demander</option><option value="included">Proposition avec vols</option><option value="excluded">Réservation par le client</option><option value="booked">Vols déjà réservés</option></select></label>
          {field('departure_city', 'Ville ou aéroport de départ', 'Ex. Paris CDG')}
        </div></fieldset>
        <fieldset><legend className="mb-3 font-semibold text-steel">Participants et chambres</legend><div className="grid gap-4 sm:grid-cols-2">
          {field('travelers_adults', 'Nombre d’adultes', 'Inconnu', 'number')}{field('travelers_children', 'Nombre d’enfants', 'Inconnu', 'number')}
          {field('children_ages', 'Âge de chaque enfant au départ', 'Ex. 5, 9, 14')}{field('room_distribution', 'Répartition des chambres', 'Ex. 1 single, 2 doubles, 1 twin')}
          {field('accommodation', 'Hébergement souhaité', 'Ex. hôtels 4*, bivouac, mixte')}
        </div></fieldset>
        <fieldset><legend className="mb-3 font-semibold text-steel">Période et budget</legend><div className="grid gap-4 sm:grid-cols-2">
          {field('travel_period', 'Dates ou période, avec l’année', 'Ex. 7–11 octobre 2027')}
          {field('duration', 'Durée souhaitée', 'Nombre de jours ou nuits, flexibilité')}
          <label className="text-sm">Devise<select value={values.currency} onChange={e => set('currency', e.target.value)} className={controlClass}><option value="">À préciser</option><option>EUR</option><option>DZD</option><option>GBP</option><option>USD</option>{currency && !['EUR', 'DZD', 'GBP', 'USD'].includes(currency) && <option value={currency}>{currency}</option>}</select></label>
          {field('budget_min', 'Budget indicatif', 'Inconnu', 'number')}{field('budget_max', 'Budget maximum', 'Facultatif', 'number')}
          <label className="text-sm">Base du budget<select value={values.budget_unit} onChange={e => set('budget_unit', e.target.value)} className={controlClass}><option value="">À préciser</option><option value="per_person">Par personne</option><option value="total">Pour le groupe</option></select></label>
          <label className="text-sm">Vols inclus dans ce budget<select value={values.budget_includes_flights} onChange={e => set('budget_includes_flights', e.target.value)} className={controlClass}><option value="">À préciser</option><option value="yes">Oui</option><option value="no">Non, hors vols</option></select></label>
        </div></fieldset>
        <fieldset><legend className="mb-3 font-semibold text-steel">Parcours et prestations</legend><div className="grid gap-4 sm:grid-cols-2">{field('itinerary', 'Étapes ou lieux souhaités', 'Ou itinéraire à proposer par l’agence')}{field('services', 'Prestations souhaitées', 'Guide, transferts, repas…')}{field('constraints', 'Contraintes et besoins particuliers', 'Ou aucune contrainte communiquée')}</div></fieldset>
        {analyzeLeadQualification(lead).expedition && <fieldset><legend className="mb-3 font-semibold text-steel">Précisions pour l’expédition</legend><div className="grid gap-4 sm:grid-cols-2">{field('expedition_water', 'Stratégie d’eau et ravitaillement', 'Portage, puits, dépôts ; adaptations acceptées')}{field('expedition_shelter', 'Bivouac, équipement et nuits avant/après', 'Abri prévu, confort et chambres éventuelles')}</div></fieldset>}
        <fieldset><legend className="mb-3 font-semibold text-steel">Arrivée et départ</legend><div className="grid gap-4 sm:grid-cols-2">
          {field('arrival_details', 'Arrivée en Algérie', 'Ville, date, horaire ou flexibilité')}{field('departure_details', 'Départ d’Algérie', 'Ville, date, horaire ou flexibilité')}
        </div></fieldset>
        <button type="submit" disabled={pending} className="rounded-md bg-steel px-4 py-2.5 text-sm font-semibold text-steel-ink disabled:opacity-50">{pending ? 'Enregistrement…' : 'Enregistrer les précisions'}</button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
      </form>
    </details>
  );
}
