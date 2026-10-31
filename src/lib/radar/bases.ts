/**
 * Radar Direction l'Algérie : les cinq bases Notion lues et écrites par le module /radar.
 * Les noms de propriétés et les options sont ceux des bases Notion (méthode du radar, 28/10/2026).
 * Ce fichier est partagé client / serveur : il ne contient aucun secret.
 */

export type BaseKey = "signaux" | "acteurs" | "rdv" | "partenariats" | "idees";
export const ORDRE: BaseKey[] = ["signaux", "acteurs", "rdv", "partenariats", "idees"];
export const estBase = (k: string): k is BaseKey => (ORDRE as string[]).includes(k);

export type TypeChamp = "text" | "select" | "multi" | "number" | "date" | "checkbox" | "url" | "relation" | "created";

export type Champ = {
  k: string;
  label: string;
  type: TypeChamp;
  opts?: string[];
  long?: boolean;
  /** Base visée par une relation, quand elle est l'une des cinq. */
  cible?: BaseKey;
};

/** Teinte d'étiquette du back office v3 (classes .tag). */
export type Ton = "" | "amber" | "green" | "teal" | "red" | "dark" | "mute";

export type Base = {
  key: BaseKey;
  label: string;
  /** « un signal », « un acteur »… */
  unite: string;
  db: string;
  titre: string;
  statut: string;
  statutType: "select" | "status";
  statuts: string[];
  tons: Record<string, Ton>;
  masques: string[];
  tri: { prop: string; dir: "asc" | "desc" };
  note: string | null;
  echeance: string | null;
  categorie: string | null;
  region: string | null;
  porteur: string | null;
  suite: string;
  meta: string[];
  dateCreation?: string;
  enCours?: string[];
  plafond?: number;
  champs: Champ[];
};

export const WILAYAS = ["National", "Alger", "Oran", "Constantine", "Annaba", "Béjaïa", "Tipaza", "Tlemcen", "Sétif", "Batna", "Biskra", "Ghardaïa", "Adrar", "Timimoun", "Béchar", "Tamanrasset", "Illizi / Djanet", "El Oued", "Ouargla", "Boumerdès", "Jijel", "Skikda", "Tizi Ouzou", "Mostaganem", "Aïn Témouchent", "Autre wilaya"];
export const REGIONS = ["Sahara", "Nord-Centre", "Kabylie", "Nord-Est", "Nord-Ouest", "Hauts-Plateaux", "National", "Hors Algérie"];
export const PORTEURS = ["Mehdi", "Houari", "Les deux"];

const c = (k: string, label: string, type: TypeChamp, extra: Partial<Champ> = {}): Champ => ({ k, label, type, ...extra });

export const BASES: Record<BaseKey, Base> = {
  signaux: {
    key: "signaux", label: "Signaux", unite: "un signal", db: "51e50ce003934b72bba15f8e6f15a00a",
    titre: "Signal", statut: "Statut", statutType: "select",
    statuts: ["À trier", "Suivi", "Actionnable", "Archivé"],
    tons: { "À trier": "amber", Suivi: "teal", Actionnable: "green", Archivé: "mute" },
    masques: ["Archivé"], tri: { prop: "Détecté le", dir: "desc" },
    note: "Note DA /10", echeance: "Fenêtre de tir", categorie: "Type", region: "Région", porteur: null,
    suite: "Prochaine action", meta: ["Type", "Région", "Éditeur"], dateCreation: "Détecté le",
    champs: [
      c("Type", "Type", "select", { opts: ["Événement", "Réglementation & visas", "Accès & transport", "Marché & chiffres", "Concurrence", "Nouvel acteur", "Opportunité partenariat", "Mention de l'Algérie", "Autre"] }),
      c("Usage DA", "Usage pour DA", "multi", { opts: ["Offre", "Distribution", "Sponsors & marque", "Institutions", "Éditorial média", "Plateforme voyage"] }),
      c("Note DA /10", "Note DA /10", "number"),
      c("Fenêtre de tir", "Fenêtre de tir", "date"),
      c("Prochaine action", "Prochaine action", "text", { long: true }),
      c("Pourquoi ça compte", "Pourquoi ça compte", "text", { long: true }),
      c("Angle DA", "Angle DA", "text", { long: true }),
      c("Acteur clé", "Acteur clé", "text"),
      c("Région", "Région", "select", { opts: REGIONS }),
      c("Wilaya", "Wilaya", "multi", { opts: WILAYAS }),
      c("Date début", "Date de début", "date"),
      c("Date fin", "Date de fin", "date"),
      c("Source", "Source", "url"),
      c("Éditeur", "Éditeur", "text"),
      c("Récurrent", "Récurrent", "checkbox"),
      c("Détecté le", "Détecté le", "date"),
      c("Acteurs liés", "Acteurs liés", "relation", { cible: "acteurs" }),
      c("Rendez-vous", "Rendez-vous", "relation", { cible: "rdv" }),
      c("Idées", "Idées", "relation", { cible: "idees" }),
    ],
  },
  acteurs: {
    key: "acteurs", label: "Acteurs", unite: "un acteur", db: "f79c0a30277e4e97b7746223e68c95d4",
    titre: "Nom", statut: "Statut", statutType: "select",
    statuts: ["Repéré", "Qualifié", "Prioritaire", "Partenaire", "Écarté"],
    tons: { Repéré: "", Qualifié: "teal", Prioritaire: "amber", Partenaire: "green", Écarté: "mute" },
    masques: ["Écarté"], tri: { prop: "Note DA /10", dir: "desc" },
    note: "Note DA /10", echeance: "Fenêtre de tir", categorie: "Famille", region: "Région", porteur: "Porteur",
    suite: "Prochaine action", meta: ["Type", "Wilaya", "Lot"],
    champs: [
      c("Famille", "Famille", "select", { opts: ["Offre", "Distribution", "Sponsors & marques", "Médias & créateurs", "Institutions", "Concurrence"] }),
      c("Type", "Type", "select", { opts: ["Agence réceptive / DMC", "Agence escapade & aventure", "Guide / accompagnateur", "Hébergement de caractère", "Transport & logistique", "Voyagiste étranger", "Plateforme / OTA", "Média voyage", "Média diaspora", "Média algérien", "Créateur / influenceur", "Podcast", "Communauté / groupe", "Annuaire / référencement", "Organisateur d'événements", "Institution algérienne", "Institution étrangère", "Office / parc / site", "Compagnie de transport", "Marque / sponsor potentiel", "Association / diaspora", "Autre"] }),
      c("Note DA /10", "Note DA /10", "number"),
      c("Porteur", "Porteur", "select", { opts: PORTEURS }),
      c("Prochaine action", "Prochaine action", "text", { long: true }),
      c("Fenêtre de tir", "Fenêtre de tir", "date"),
      c("Interlocuteur", "Interlocuteur", "text"),
      c("Contact public", "Contact public", "text"),
      c("Site & réseaux", "Site et réseaux", "text", { long: true }),
      c("Audience constatée", "Audience constatée", "text"),
      c("Rôle pour DA", "Rôle pour DA", "multi", { opts: ["Fournisseur de voyages", "Relais d'audience", "Sponsor potentiel", "Prescripteur", "Autorité / accès", "Concurrent", "Source de contenu"] }),
      c("Spécialités", "Spécialités", "multi", { opts: ["Sahara & désert", "Trek & randonnée", "Culturel & patrimoine", "Algérie antique", "Balnéaire", "Montagne", "Gastronomie", "Diaspora / retour aux sources", "Premium", "Famille", "Aventure & sport", "Thermal & bien-être", "Photo & tournage"] }),
      c("Pays", "Pays", "select", { opts: ["Algérie", "France", "Belgique", "Canada", "Autre"] }),
      c("Région", "Région", "select", { opts: REGIONS }),
      c("Wilaya", "Wilaya", "multi", { opts: WILAYAS }),
      c("Langues", "Langues", "multi", { opts: ["Français", "Arabe", "Tamazight", "Anglais"] }),
      c("Licence", "Licence", "select", { opts: ["Vérifiée", "Affichée non vérifiée", "Non trouvée", "Non applicable"] }),
      c("Source", "Source", "url"),
      c("Vérifié le", "Vérifié le", "date"),
      c("Lot", "Lot", "text"),
      c("Créé le", "Créé le", "created"),
      c("Signaux", "Signaux", "relation", { cible: "signaux" }),
      c("Rendez-vous", "Rendez-vous", "relation", { cible: "rdv" }),
      c("Partenariats", "Partenariats", "relation", { cible: "partenariats" }),
      c("Idées opérables", "Idées qu'il peut opérer", "relation", { cible: "idees" }),
    ],
  },
  rdv: {
    key: "rdv", label: "Rendez-vous", unite: "un rendez-vous", db: "d0db09c16ffa47bd988500e5962357b2",
    titre: "Rendez-vous", statut: "Statut", statutType: "select",
    statuts: ["Repéré", "Dates à confirmer", "Retenu", "Inscrit ou prévu", "Passé", "Écarté"],
    tons: { Repéré: "", "Dates à confirmer": "amber", Retenu: "teal", "Inscrit ou prévu": "green", Passé: "mute", Écarté: "mute" },
    masques: ["Passé", "Écarté"], tri: { prop: "Date début", dir: "asc" },
    note: "Note DA /10", echeance: "Échéance d'inscription", categorie: "Type", region: "Région", porteur: "Porteur",
    suite: "Prochaine action", meta: ["Type", "Ville & lieu", "Date début"],
    champs: [
      c("Type", "Type", "select", { opts: ["Salon pro", "Salon grand public", "Festival & fête locale", "Événement culturel", "Événement diaspora", "Festival de films", "Conférence & forum", "Autre"] }),
      c("Date début", "Date de début", "date"),
      c("Date fin", "Date de fin", "date"),
      c("Échéance d'inscription", "Échéance d'inscription", "date"),
      c("Mode de présence", "Mode de présence", "multi", { opts: ["Couvrir", "Visiter", "Exposer", "Intervenir ou projeter", "Bâtir un circuit autour", "À arbitrer"] }),
      c("Note DA /10", "Note DA /10", "number"),
      c("Porteur", "Porteur", "select", { opts: PORTEURS }),
      c("Prochaine action", "Prochaine action", "text", { long: true }),
      c("Pays", "Pays", "select", { opts: ["Algérie", "France", "International"] }),
      c("Ville & lieu", "Ville et lieu", "text"),
      c("Région", "Région", "select", { opts: REGIONS }),
      c("Récurrent", "Récurrent", "checkbox"),
      c("Source", "Source", "url"),
      c("Organisateur", "Organisateur", "relation", { cible: "acteurs" }),
      c("Signal d'origine", "Signal d'origine", "relation", { cible: "signaux" }),
      c("Partenariats", "Partenariats", "relation", { cible: "partenariats" }),
    ],
  },
  partenariats: {
    key: "partenariats", label: "Partenariats", unite: "un dossier", db: "f6d4d098948d488ebbb621c8391558f6",
    titre: "Dossier", statut: "Étape", statutType: "status",
    statuts: ["À ouvrir", "En pause", "Premier contact", "En discussion", "Proposition ou test", "Signé ou actif", "Perdu"],
    tons: { "À ouvrir": "", "En pause": "mute", "Premier contact": "teal", "En discussion": "amber", "Proposition ou test": "amber", "Signé ou actif": "green", Perdu: "mute" },
    masques: ["Perdu"], tri: { prop: "Échéance", dir: "asc" },
    note: null, echeance: "Échéance", categorie: "Type", region: null, porteur: "Porteur",
    suite: "Prochaine action", meta: ["Type", "Porteur", "Priorité"],
    enCours: ["Premier contact", "En discussion", "Proposition ou test"], plafond: 8,
    champs: [
      c("Type", "Type", "select", { opts: ["Recrutement agence", "Prestataire terrain", "Sponsoring", "Contenu de marque", "Collaboration créateur", "Relations presse", "Partenariat institutionnel", "Présence salon ou événement", "Distribution ou référencement"] }),
      c("Porteur", "Porteur", "select", { opts: PORTEURS }),
      c("Priorité", "Priorité", "select", { opts: ["P1", "P2", "P3"] }),
      c("Échéance", "Échéance", "date"),
      c("Prochaine action", "Prochaine action", "text", { long: true }),
      c("Ce que DA apporte", "Ce que DA apporte", "text", { long: true }),
      c("Ce que DA attend", "Ce que DA attend", "text", { long: true }),
      c("Dernier contact", "Dernier contact", "date"),
      c("Ouvert le", "Ouvert le", "created"),
      c("Acteurs", "Acteurs", "relation", { cible: "acteurs" }),
      c("Rendez-vous", "Rendez-vous", "relation", { cible: "rdv" }),
    ],
  },
  idees: {
    key: "idees", label: "Idées", unite: "une idée", db: "28b5d3d60c7d447086267a79db731032",
    titre: "Idée", statut: "Statut", statutType: "select",
    statuts: ["Proposée", "Retenue", "Transmise", "Écartée"],
    tons: { Proposée: "amber", Retenue: "teal", Transmise: "green", Écartée: "mute" },
    masques: ["Écartée"], tri: { prop: "Note /10", dir: "desc" },
    note: "Note /10", echeance: "Publier avant", categorie: "Site", region: null, porteur: null,
    suite: "Angle", meta: ["Site", "Format média", "Format plateforme", "Cluster"], dateCreation: "Proposée le",
    champs: [
      c("Site", "Site", "select", { opts: ["Média", "Plateforme"] }),
      c("Format média", "Format média", "select", { opts: ["grand-format-ville", "grand-format-thematique", "poi-dedie", "gastronomie", "immateriel", "validation-media", "guide-pratique", "actu-chaude"] }),
      c("Format plateforme", "Format plateforme", "select", { opts: ["Page lieu à ouvrir", "Expérience", "Activité ou spot", "Événement daté", "Circuit ou voyage", "Conseil pratique", "Page d'envie"] }),
      c("Note /10", "Note /10", "number"),
      c("Angle", "Angle", "text", { long: true }),
      c("Preuve", "Preuve", "text", { long: true }),
      c("Mot-clé visé", "Mot-clé visé", "text"),
      c("Publier avant", "Publier avant", "date"),
      c("Déclencheur", "Déclencheur", "select", { opts: ["Actualité", "Calendrier ou saison", "Demande de recherche", "Manque Cortex ou référentiel", "Concurrent", "Question de voyageur", "Offre d'agence", "Épisode de la série"] }),
      c("Cluster", "Cluster", "select", { opts: ["alger", "sahara", "tipaza", "kabylie", "mzab", "oran", "constantine", "tlemcen", "bejaia", "annaba", "transverse", "autre"] }),
      c("Couverture existante", "Couverture existante", "select", { opts: ["Nouveau", "Mise à jour d'un existant", "Doublon"] }),
      c("Contenu existant", "Contenu existant", "text"),
      c("Cortex", "Cortex", "select", { opts: ["🟢 OK", "🟡 Partiel", "🔴 Manquant"] }),
      c("Offre agence", "Offre agence", "select", { opts: ["Couverte", "Non couverte", "Non applicable"] }),
      c("Source", "Source", "url"),
      c("Proposée le", "Proposée le", "date"),
      c("Opérable par", "Opérable par", "relation", { cible: "acteurs" }),
      c("Signal d'origine", "Signal d'origine", "relation", { cible: "signaux" }),
      c("Sujet créé", "Sujet créé (Sujets d'articles)", "relation"),
      c("Ticket créé", "Ticket créé (Backlog produit)", "relation"),
    ],
  },
};

export const champDe = (b: Base, k: string): Champ | null => b.champs.find((f) => f.k === k) ?? null;

/** Page racine du radar et page de contexte de l'agent dans Notion. */
export const NOTION_RADAR_PAGE = "40773be62c5b8127a03ec19404967ad0";
export const NOTION_METHODE_PAGE = "40773be62c5b81259438c78e83d9905a";
export const lienNotion = (id: string) => `https://app.notion.com/p/${id.replace(/-/g, "")}`;

export const COULEUR_REGION: Record<string, string> = {
  Sahara: "#E9C48B", "Nord-Centre": "#9DB7E8", Kabylie: "#6BD8FF", "Nord-Est": "#FFC48A", "Nord-Ouest": "#F6A72D",
  "Hauts-Plateaux": "#D8C3A5", National: "#98A4AB", "Hors Algérie": "#7FD8B4",
};
