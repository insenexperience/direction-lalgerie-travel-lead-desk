// GÉNÉRÉ depuis le Composer du site (guide/composer/data.js). Ne pas éditer à la main.
// Coordonnées : carte du site, viewBox 620 × 600. Zones : celles des agences partenaires.

export type Zone = "nord" | "kabylie" | "est" | "ouest" | "sahara";

export const ZONES: Record<Zone, string> = { nord: "Nord & Alger", kabylie: "Kabylie", est: "L’Est", ouest: "L’Ouest", sahara: "Sahara" };

export type Lieu = { nom: string; zone: Zone; x: number; y: number };

export const LIEUX: Record<string, Lieu> = {
  "alger": {
    "nom": "Alger",
    "zone": "nord",
    "x": 349,
    "y": 25
  },
  "tipaza": {
    "nom": "Tipaza",
    "zone": "nord",
    "x": 325,
    "y": 22
  },
  "chrea": {
    "nom": "Chréa & la Chiffa",
    "zone": "nord",
    "x": 342,
    "y": 44
  },
  "bejaia": {
    "nom": "Béjaïa & Gouraya",
    "zone": "kabylie",
    "x": 377,
    "y": 32
  },
  "tikjda": {
    "nom": "Tikjda & le Djurdjura",
    "zone": "kabylie",
    "x": 386,
    "y": 44
  },
  "kherrata": {
    "nom": "Gorges de Kherrata",
    "zone": "kabylie",
    "x": 403,
    "y": 34
  },
  "jijel": {
    "nom": "Corniche jijelienne",
    "zone": "est",
    "x": 428,
    "y": 21
  },
  "collo": {
    "nom": "Collo",
    "zone": "est",
    "x": 447,
    "y": 17
  },
  "constantine": {
    "nom": "Constantine",
    "zone": "est",
    "x": 448,
    "y": 38
  },
  "djemila": {
    "nom": "Djemila",
    "zone": "est",
    "x": 428,
    "y": 43
  },
  "annaba": {
    "nom": "Annaba & Hippone",
    "zone": "est",
    "x": 492,
    "y": 22
  },
  "elkala": {
    "nom": "Parc d’El Kala",
    "zone": "est",
    "x": 512,
    "y": 27
  },
  "timgad": {
    "nom": "Timgad",
    "zone": "est",
    "x": 444,
    "y": 69
  },
  "ghoufi": {
    "nom": "Balcons du Ghoufi",
    "zone": "est",
    "x": 452,
    "y": 85
  },
  "biskra": {
    "nom": "Biskra & les Ziban",
    "zone": "est",
    "x": 447,
    "y": 99
  },
  "oran": {
    "nom": "Oran",
    "zone": "ouest",
    "x": 246,
    "y": 61
  },
  "habibas": {
    "nom": "Îles Habibas",
    "zone": "ouest",
    "x": 233,
    "y": 52
  },
  "tlemcen": {
    "nom": "Tlemcen",
    "zone": "ouest",
    "x": 227,
    "y": 89
  },
  "ghardaia": {
    "nom": "Ghardaïa & le M’zab",
    "zone": "sahara",
    "x": 366,
    "y": 170
  },
  "beniisguen": {
    "nom": "Beni Isguen",
    "zone": "sahara",
    "x": 372,
    "y": 176
  },
  "taghit": {
    "nom": "Taghit",
    "zone": "sahara",
    "x": 172,
    "y": 214
  },
  "beniabbes": {
    "nom": "Béni Abbès",
    "zone": "sahara",
    "x": 152,
    "y": 244
  },
  "timimoun": {
    "nom": "Timimoun",
    "zone": "sahara",
    "x": 242,
    "y": 298
  },
  "djanet": {
    "nom": "Djanet",
    "zone": "sahara",
    "x": 529,
    "y": 423
  },
  "tadrart": {
    "nom": "Tadrart & Tin Merzouga",
    "zone": "sahara",
    "x": 546,
    "y": 452
  },
  "essendilene": {
    "nom": "Oued Essendilène",
    "zone": "sahara",
    "x": 514,
    "y": 404
  },
  "sefar": {
    "nom": "Plateau de Sefar",
    "zone": "sahara",
    "x": 520,
    "y": 438
  },
  "tam": {
    "nom": "Tamanrasset",
    "zone": "sahara",
    "x": 418,
    "y": 476
  },
  "assekrem": {
    "nom": "L’Assekrem",
    "zone": "sahara",
    "x": 429,
    "y": 461
  },
  "theniet": {
    "nom": "Cédraie de Théniet El Had",
    "zone": "nord",
    "x": 319.6,
    "y": 66.4
  }
};

export const DZ_PATH =
  "M20.9,334.0L21.5,328.0L21.4,325.8L21.2,288.2L66.4,264.6L94.3,259.7L117.1,251.0L127.9,234.9L160.5,222.0L161.7,197.7L177.9,194.9L190.6,182.7L227.1,177.2L232.2,164.3L224.9,157.2L215.2,121.9L213.5,101.3L203.0,79.5L229.9,60.7L260.1,54.8L277.7,40.5L304.7,29.9L352.1,23.7L398.3,20.9L412.3,26.0L438.7,12.3L468.6,12L480.0,20.1L499.1,18.0L493.3,35.9L497.8,68.8L491.2,97.0L474.0,115.9L476.4,141.2L499.3,161.1L499.6,169.1L516.8,182.4L528.7,241.1L537.7,269.6L539.2,284.4L534.3,310.4L536.4,324.9L532.8,342.1L535.2,361.7L524.1,374.8L540.6,397.4L541.7,410.6L551.7,427.8L564.8,422.2L586.8,436.4L599.1,455.6L503.3,513.2L422.4,571.9L383.0,585.1L352.0,588L351.7,569.1L338.7,564.3L321.3,555.8L314.6,541.8L220.3,476.2L126.1,409.5Z";
