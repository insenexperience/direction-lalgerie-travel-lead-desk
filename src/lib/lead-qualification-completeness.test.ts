import assert from "node:assert/strict";
import test from "node:test";
import { analyzeLeadQualification, type LeadQualificationInput } from "./lead-qualification-completeness";

const complete: LeadQualificationInput = {
  travelers_adults: 2,
  travelers_children: 2,
  travel_start_date: "2027-01-10",
  travel_end_date: "2027-01-18",
  budget_min: 2000,
  budget_unit: "per_person",
  currency: "EUR",
  destination_main: "Alger, Tipaza et Constantine",
  intake_payload: {
    qualification_facts: {
      flight_mode: "excluded",
      travelers_adults: 2,
      travelers_children: 2,
      children_ages: "6, 9",
      room_distribution: "2 chambres doubles",
      budget_includes_flights: false,
      accommodation: "Hôtels 4 étoiles",
    },
  },
};
const ids = (lead: LeadQualificationInput) => analyzeLeadQualification(lead).questions.map((question) => question.id);

test("unknown intake database defaults never confirm participants", () => {
  const analysis = analyzeLeadQualification({ travelers_adults: 1, travelers_children: 0 });
  assert.equal(analysis.readyForAgencyBrief, false);
  assert.deepEqual(analysis.questions.slice(0, 3).map((q) => q.id), ["flights", "participants", "rooms"]);
  assert.ok(analysis.missingRequired.includes("participants"));
});

test("AI suggestions are not confirmed group or accommodation facts", () => {
  const analysis = analyzeLeadQualification({ qualification_blocks: { group: { ai_suggestions: ["solo"], op_action: null }, stay: { ai_suggestions: ["bivouac"], op_action: null } } });
  assert.ok(analysis.missingRequired.includes("participants"));
  assert.ok(analysis.missingRequired.includes("rooms"));
});

test("a validated friends chip does not validate the default one-adult/no-child pair", () => {
  const analysis = analyzeLeadQualification({ travelers_adults: 1, travelers_children: 0, qualification_blocks: { group: { op_action: "confirmed", op_selections: ["friends", "small_group"] } } });
  assert.ok(analysis.missingRequired.includes("participants"));
});

test("known total asks only for composition, without asking the same total again", () => {
  const question = analyzeLeadQualification({ intake_payload: { travellers_count: "4", group_type: "Amis" }, travelers_adults: 1, travelers_children: 0 }).questions.find((q) => q.id === "participants");
  assert.match(question?.question ?? "", /les 4 participants annoncés/);
  assert.doesNotMatch(question?.question ?? "", /Combien de personnes/);
});

test("confirmed facts remove answered questions and permit an actionable brief", () => {
  const analysis = analyzeLeadQualification(complete);
  assert.equal(analysis.readyForAgencyBrief, true);
  assert.equal(analysis.completeness, 100);
  assert.deepEqual(analysis.missingRequired, []);
  assert.deepEqual(analysis.questions.map((q) => q.id), ["arrival_departure", "services", "constraints"]);
});

test("flights included ask departure airport first, self managed do not", () => {
  const included = { ...complete, intake_payload: { qualification_facts: { flight_mode: "included" } } };
  assert.equal(analyzeLeadQualification(included).questions[0].id, "departure_city");
  assert.ok(!ids(complete).includes("departure_city"));
});

test("traveler form responses are reused, room count alone needs room types", () => {
  const analysis = analyzeLeadQualification({
    traveler_responses: {
      travelers: [{ age: 41 }, { age: 39 }, { age: 9 }],
      rooms: "two_rooms",
      flights: { mode: "already_booked", departure_city: "Paris" },
      wishes: { must_see: ["tipaza"], structure: "fixed" },
      constraints: { accompaniment: "full_guide", board: "breakfast", diet: [] },
    },
  });
  assert.ok(!analysis.questions.some((q) => ["participants", "children_ages", "flights", "itinerary", "services", "constraints"].includes(q.id)));
  assert.ok(analysis.questions.some((q) => q.id === "rooms"));
});

test("each child age is needed, never inferred from group defaults", () => {
  const analysis = analyzeLeadQualification({ intake_payload: { qualification_facts: { adults: 2, children: 2, children_ages: [6] } } });
  assert.ok(analysis.missingRequired.includes("children_ages"));
  assert.ok(!analysis.missingRequired.includes("participants"));
});

test("edited logistics counts take precedence over earlier intake and traveler form", () => {
  const analysis = analyzeLeadQualification({ intake_payload: { travellers_count: "2", qualification_facts: { adults: 3, children: 0 } }, traveler_responses: { travelers: [{ age: 30 }, { age: 31 }] } });
  assert.match(analysis.checklist.find((item) => item.id === "participants")?.value ?? "", /3 adulte/);
  assert.ok(!analysis.missingRequired.includes("participants"));
});

test("a room distribution that cannot fit all participants must be clarified", () => {
  const analysis = analyzeLeadQualification({ intake_payload: { qualification_facts: { adults: 4, children: 0, room_distribution: { single: 2 } } } });
  assert.match(analysis.questions.find((q) => q.id === "rooms")?.question ?? "", /ne semble pas couvrir/);
  assert.ok(analyzeLeadQualification({ intake_payload: { qualification_facts: { adults: 4, children: 0, room_distribution: "2 chambres individuelles" } } }).missingRequired.includes("rooms"));
});

test("dates without a year remain unknown even when intake was submitted this year", () => {
  const analysis = analyzeLeadQualification({ trip_dates: "7–11 octobre", intake_payload: { submitted_at: "2026-10-05", notes_longues: "Import du 5 octobre 2026" } });
  assert.ok(analysis.missingRequired.includes("dates"));
  assert.match(analysis.questions.find((q) => q.id === "dates")?.question ?? "", /confirmer l’année/);
});

test("budget chips cannot substitute for amount and budget basis", () => {
  const analysis = analyzeLeadQualification({ qualification_blocks: { budget: { op_action: "confirmed", op_selections: ["budget_mid"] } } });
  assert.ok(analysis.missingRequired.includes("budget"));
});

test("manual import amount does not invent a per-person basis or default EUR currency", () => {
  const analysis = analyzeLeadQualification({ currency: "EUR", intake_payload: { import_mode: "manual_message", budget_ideal: "2000", qualification_facts: { budget_min: 2000 } } });
  assert.ok(analysis.missingRequired.includes("budget"));
  const unknownCurrency = analyzeLeadQualification({ budget_min: 2000, budget_unit: "total", currency: "EUR", intake_payload: { manual_qualification: { currency: "" } } });
  assert.ok(unknownCurrency.missingRequired.includes("budget"));
});

test("year alone is not a usable travel period", () => {
  assert.ok(analyzeLeadQualification({ travel_period: "2027" }).missingRequired.includes("dates"));
});

test("legacy budget text and known flight scope remain usable", () => {
  const analysis = analyzeLeadQualification({ budget: "1 800–2 100 € / pers. hors vols" });
  assert.ok(!analysis.missingRequired.includes("budget"));
  assert.ok(!analysis.missingRequired.includes("budget_scope"));
});

test("explicit foreign currency budget facts are read without conversion", () => {
  const analysis = analyzeLeadQualification({ currency: "EUR", intake_payload: { qualification_facts: { budget_min: 300000, budget_unit: "total", currency: "DZD", budget_includes_flights: false } } });
  assert.ok(!analysis.missingRequired.includes("budget"));
  assert.match(analysis.checklist.find((c) => c.id === "budget")?.value ?? "", /300000 DZD total/);
});

test("Jamie's unsupported solo traverse gets expedition questions, not children or hotel rooms", () => {
  const analysis = analyzeLeadQualification({
    travelers: "Solo — nationalité britannique · 1 voyageur(s)",
    travel_style: "Unsupported foot traverse, Djanet → Tamanrasset, no food resupply",
    trip_dates: "Arrival 20–25 January 2027; late January–February; departure late February / early March 2027",
    intake_payload: { notes_longues: "I would carry my own equipment. Could your team verify wells? What emergency support would be required?" },
  }, { language: "en" });
  assert.equal(analysis.expedition, true);
  assert.ok(!analysis.questions.some((q) => ["participants", "children_ages", "rooms", "accommodation", "dates", "duration"].includes(q.id)));
  assert.ok(analysis.questions.some((q) => q.id === "expedition_water"));
  assert.ok(analysis.questions.some((q) => q.id === "expedition_shelter"));
  assert.equal(analysis.questions[0].label, "Flights");
});

test("confirmed bivouac-only stay does not request hotel room allocation", () => {
  const analysis = analyzeLeadQualification({ qualification_blocks: { stay: { op_action: "confirmed", op_selections: ["bivouac", "basic"] } } });
  assert.equal(analysis.checklist.find((item) => item.id === "rooms")?.status, "not_applicable");
  assert.ok(!analysis.questions.some((q) => q.id === "accommodation"));
});

const operatorTrame = {
  titre: "Circuit patrimoine",
  circuit: null,
  cadre: { duree: "4 jours", rythme: "équilibré", hebergement: "Hôtel 4 étoiles", mois: "octobre 2027", souplesse: "flexibles" },
  groupe: { type: "amis", nombre: 4, enfants: 0 },
  budget: "1 800 € par personne, hors vol",
  envies: { grandes: ["Patrimoine"], experiences: [], activites: [], pepites: [] },
  jours: [{ n: 1, lieux: ["alger"], e: "Casbah" }, { n: 2, lieux: ["tipaza"], e: "Vestiges" }],
  ajuster: [],
  precisions: "",
};

test("BO3 confirmed operator trame supplies composition, dates, duration, budget and itinerary", () => {
  const analysis = analyzeLeadQualification({ travelers_adults: 1, travelers_children: 0, ai_qualification_payload: { trame_v3: operatorTrame } });
  assert.ok(!analysis.questions.some((question) => ["participants", "children_ages", "dates", "duration", "budget", "budget_scope", "accommodation", "itinerary"].includes(question.id)));
  assert.match(analysis.checklist.find((item) => item.id === "participants")?.value ?? "", /4 adulte/);
  assert.deepEqual(analysis.questions.slice(0, 2).map((question) => question.id), ["flights", "rooms"]);
});

test("BO3 total alone still requests adult/child composition and known children require ages", () => {
  const unconfirmedChildren = analyzeLeadQualification({ ai_qualification_payload: { trame_v3: { ...operatorTrame, groupe: { type: "famille", nombre: 4, enfants: null } } } });
  assert.match(unconfirmedChildren.questions.find((question) => question.id === "participants")?.question ?? "", /les 4 participants annoncés/);
  const confirmedChildren = analyzeLeadQualification({ ai_qualification_payload: { trame_v3: { ...operatorTrame, groupe: { type: "famille", nombre: 4, enfants: 2 } } } });
  assert.ok(!confirmedChildren.missingRequired.includes("participants"));
  assert.ok(confirmedChildren.missingRequired.includes("children_ages"));
});

test("BO3 month without year never borrows a year from older site or legacy dates", () => {
  const analysis = analyzeLeadQualification({ trip_dates: "septembre 2027", intake_payload: { trame: { cadre: { mois: "septembre 2027" } } }, ai_qualification_payload: { trame_v3: { ...operatorTrame, cadre: { ...operatorTrame.cadre, mois: "octobre" } } } });
  assert.ok(analysis.missingRequired.includes("dates"));
  assert.match(analysis.questions.find((question) => question.id === "dates")?.question ?? "", /confirmer l’année/);
});

test("site composer explicit details are reused, absent composition values are not defaults", () => {
  const analysis = analyzeLeadQualification({ travelers_adults: 1, travelers_children: 0, intake_payload: { trame: {
    nom: "Mon projet",
    cadre: { duree: "7 jours", mois: "février 2027", hebergement: "Bivouac" },
    groupe: { type: "famille", nombre: 4, enfants: 1 },
    budget: { par_personne_hors_vol: "1 200 €" },
    envies: { grandes: [{ titre: "Nature" }] },
    jours: [{ num: 1, lieux: [{ id: "djanet" }] }],
  } } });
  assert.ok(!analysis.missingRequired.includes("participants"));
  assert.ok(analysis.missingRequired.includes("children_ages"));
  assert.ok(!analysis.questions.some((question) => ["dates", "duration", "budget", "budget_scope", "accommodation", "itinerary", "rooms"].includes(question.id)));
});

test("unusable BO3 budget or incomplete ai suggestion is not a confirmed price", () => {
  const analysis = analyzeLeadQualification({ ai_qualification_payload: { trame_v3: { ...operatorTrame, budget: "À définir avec l'agence" } } });
  assert.ok(analysis.missingRequired.includes("budget"));
  const invalid = analyzeLeadQualification({ ai_qualification_payload: { trame_v3: { groupe: { nombre: 4, enfants: 0 }, budget: "1 800 € par personne" } } });
  assert.ok(invalid.missingRequired.includes("participants"));
  assert.ok(invalid.missingRequired.includes("budget"));
});

test("canonical facts outrank BO3 trame and explicitly unknown currency or unit outranks legacy EUR", () => {
  const edited = analyzeLeadQualification({ ai_qualification_payload: { trame_v3: operatorTrame }, intake_payload: { qualification_facts: { adults: 3, children: 0, travel_period: "mars 2028", accommodation: "Maison d’hôtes" } } });
  assert.match(edited.checklist.find((item) => item.id === "participants")?.value ?? "", /3 adulte/);
  assert.equal(edited.checklist.find((item) => item.id === "dates")?.value, "mars 2028");
  assert.equal(edited.checklist.find((item) => item.id === "accommodation")?.value, "Maison d’hôtes");
  for (const blank of [null, ""]) {
    const currencyUnknown = analyzeLeadQualification({ budget_min: 2000, budget_unit: "per_person", currency: "EUR", budget: "2 000 € par personne", ai_qualification_payload: { trame_v3: operatorTrame }, intake_payload: { qualification_facts: { budget_min: 2000, currency: blank } } });
    assert.ok(currencyUnknown.missingRequired.includes("budget"));
    const unitUnknown = analyzeLeadQualification({ budget_min: 2000, budget_unit: "per_person", currency: "EUR", budget: "2 000 € par personne", intake_payload: { qualification_facts: { budget_min: 2000, currency: "EUR", budget_unit: blank } } });
    assert.ok(unitUnknown.missingRequired.includes("budget"));
  }
});

test("cleared canonical composition cannot be restored from BO3, legacy counts, solo text or public answers", () => {
  for (const blank of [null, ""]) {
    const analysis = analyzeLeadQualification({
      travelers: "Solo · 1 voyageur",
      travelers_adults: 4,
      travelers_children: 2,
      ai_qualification_payload: { trame_v3: operatorTrame },
      traveler_responses: { travelers: [{ age: 30 }, { age: 31 }, { age: 9 }] },
      intake_payload: { qualification_facts: { travelers_adults: blank, travelers_children: blank } },
    });
    assert.ok(analysis.missingRequired.includes("participants"));
    assert.equal(analysis.readyForAgencyBrief, false);
  }
});

test("cleared canonical child ages remain missing despite older traveler ages", () => {
  const analysis = analyzeLeadQualification({ traveler_responses: { travelers: [{ age: 30 }, { age: 9 }] }, intake_payload: { children_ages: [9], qualification_facts: { adults: 1, children: 1, children_ages: null } } });
  assert.ok(analysis.missingRequired.includes("children_ages"));
});

test("explicit child ages in natural French and English are reused", () => {
  for (const childrenAges of ["6 ans,9 ans", "6ans; 9ans", "âgés de 6 et 9 ans", "aged 6 and 9 years", "aged6 and9 years", "6,9", "6;9"]) {
    const analysis = analyzeLeadQualification({ intake_payload: { qualification_facts: { adults: 2, children: 2, children_ages: childrenAges } } });
    assert.ok(!analysis.missingRequired.includes("children_ages"), childrenAges);
    assert.equal(analysis.checklist.find((item) => item.id === "children_ages")?.value, "6, 9");
  }
});

test("age ranges, months and invalid ages never silently become known ages in years", () => {
  for (const childrenAges of ["6-9 ans", "6–9 years", "entre 6 et 9 ans", "6 to 9 years", "6 mois", "6 months", "6, 99", [6, 99]]) {
    const analysis = analyzeLeadQualification({ intake_payload: { qualification_facts: { adults: 2, children: 1, children_ages: childrenAges } } });
    assert.ok(analysis.missingRequired.includes("children_ages"), String(childrenAges));
  }
  assert.ok(!analyzeLeadQualification({ intake_payload: { qualification_facts: { adults: 2, children: 1, children_ages: "0 ans" } } }).missingRequired.includes("children_ages"));
});
