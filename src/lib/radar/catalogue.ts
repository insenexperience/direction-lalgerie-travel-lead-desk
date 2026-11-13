import "server-only";
import { unstable_cache } from "next/cache";

const SITE = "https://www.directionlalgerie.com";
const PLAN = `${SITE}/sitemap.xml`;
const TYPES = {
  lieux: "poi",
  villes: "ville",
  regions: "region",
  territoires: "territoire",
  experiences: "experience",
} as const;
const CHEMIN_PUBLIC = /^\/(lieux|villes|regions|territoires|experiences)\/[a-z0-9-]+$/;

type Lieu = {
  nom: string;
  type: (typeof TYPES)[keyof typeof TYPES];
  region: string;
  description: string;
  url: string;
};

function objet(valeur: unknown): Record<string, unknown> {
  return valeur && typeof valeur === "object" && !Array.isArray(valeur) ? valeur as Record<string, unknown> : {};
}

function liste(valeur: unknown): unknown[] {
  return Array.isArray(valeur) ? valeur : [];
}

function texte(valeur: unknown, limite = 120): string {
  return typeof valeur === "string" ? valeur.trim().slice(0, limite) : "";
}

async function lirePublic(url: string, limite: number): Promise<string> {
  const reponse = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  if (!reponse.ok || Number(reponse.headers.get("content-length")) > limite) throw new Error("Source publique indisponible.");
  const contenu = await reponse.text();
  if (contenu.length > limite) throw new Error("Source publique trop volumineuse.");
  return contenu;
}

function donneesPubliees(source: string, nom: "MODELE" | "EXPERIENCES"): Record<string, unknown> {
  // Le site génère une ligne `export const …=geler(<JSON>);`. Lire uniquement le JSON.
  const prefixe = `export const ${nom}=geler(`;
  const ligne = source.split(/\r?\n/).find((l) => l.startsWith(prefixe))?.trimEnd();
  if (!ligne?.endsWith(");")) throw new Error("Format du catalogue public inconnu.");
  const resultat = objet(JSON.parse(ligne.slice(prefixe.length, -2)));
  if (!Object.keys(resultat).length) throw new Error("Catalogue public vide.");
  return resultat;
}

const lireCatalogue = unstable_cache(async (): Promise<Lieu[]> => {
  const [sitemap, source, experiences] = await Promise.all([
    lirePublic(PLAN, 300_000),
    lirePublic(`${SITE}/guide/referentiel/donnees.js`, 5_000_000),
    lirePublic(`${SITE}/guide/referentiel/experiences.js`, 500_000),
  ]);
  const publies = new Set(Array.from(sitemap.matchAll(/<loc>\s*(https:\/\/www\.directionlalgerie\.com\/[^<\s]+)\s*<\/loc>/g), (m) => m[1]));
  const modele = donneesPubliees(source, "MODELE");
  const regions = liste(modele.regions).map(objet);
  const nomsRegions = new Map(regions.map((r) => [texte(r.id), texte(r.name)]));
  const resultats = new Map<string, Lieu>();

  const ajouter = (chemin: string, nom: string, region: string, description: string) => {
    const match = CHEMIN_PUBLIC.exec(chemin);
    const url = `${SITE}${chemin}`;
    if (match && nom && publies.has(url)) {
      resultats.set(url, { nom, type: TYPES[match[1] as keyof typeof TYPES], region, description, url });
    }
  };

  for (const fiche of [...regions, ...liste(modele.territoires).map(objet), ...liste(modele.places).map(objet)]) {
    ajouter(texte(fiche.href, 200), texte(fiche.name), texte(fiche.regionName), texte(fiche.description, 420) || texte(fiche.cardDescription, 420));
  }

  for (const [slug, fiche] of Object.entries(donneesPubliees(experiences, "EXPERIENCES"))) {
    const experience = objet(fiche);
    const noms = liste(experience.regions).map((id) => nomsRegions.get(texte(id))).filter(Boolean).join(", ");
    const cle = texte(experience.ancienneCle);
    const historique = cle.startsWith("experiences:") ? `/experiences/${cle.slice("experiences:".length)}` : "";
    const chemin = publies.has(`${SITE}${historique}`) ? historique : `/experiences/${slug}`;
    ajouter(chemin, texte(experience.titre), texte(noms), texte(experience.resume, 420));
  }

  if (!resultats.size) throw new Error("Le catalogue public ne correspond pas au plan du site.");
  return Array.from(resultats.values());
}, ["radar-catalogue-lieux-v1"], { revalidate: 3600 });

function normaliser(valeur: string) {
  return valeur.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function chercherLieux({ recherche, region, type, limite }: {
  recherche?: string;
  region?: string;
  type?: string;
  limite?: number;
} = {}) {
  const requete = normaliser(texte(recherche));
  const filtreRegion = normaliser(texte(region));
  const filtreType = texte(type);
  if (filtreType && !Object.values<string>(TYPES).includes(filtreType)) {
    return { erreur: "Type de fiche inconnu. Utilise poi, ville, region, territoire ou experience." };
  }
  const mots = requete.split(" ").filter(Boolean);
  const nombre = typeof limite === "number" && Number.isFinite(limite) ? Math.min(15, Math.max(1, Math.floor(limite))) : 8;

  try {
    const catalogue = await lireCatalogue();
    const resultats = catalogue
      .filter((lieu) => (!filtreType || lieu.type === filtreType) && normaliser(lieu.region).includes(filtreRegion))
      .map((lieu) => ({ lieu, titre: normaliser(lieu.nom), index: normaliser(`${lieu.nom} ${lieu.region} ${lieu.description} ${new URL(lieu.url).pathname}`) }))
      .filter(({ index }) => mots.every((mot) => index.includes(mot)))
      .sort((a, b) => Number(b.titre.includes(requete)) - Number(a.titre.includes(requete)) || a.lieu.nom.localeCompare(b.lieu.nom, "fr"));
    return { source: PLAN, total: resultats.length, lieux: resultats.slice(0, nombre).map(({ lieu }) => lieu) };
  } catch {
    return { erreur: "Le catalogue public de Direction l’Algérie est indisponible pour le moment." };
  }
}
