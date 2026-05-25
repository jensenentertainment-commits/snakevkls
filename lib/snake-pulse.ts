// lib/snake-pulse.ts

export type PulseCategory =
  | "stable"
  | "warning"
  | "critical"
  | "structure"
  | "activity"
  | "existential";

type PulseContext = {
  missingLocations?: number;
  quantityDiffs?: number;
  unresolvedIssues?: number;
  warehouseHealth?: number;
  pickEnabled?: boolean;
};

const PULSES: Record<PulseCategory, string[]> = {
  stable: [
    "Systemet fungerer som forventet.",
    "Ingen kritiske avvik registrert.",
    "Lokasjonsstruktur vurderes som stabil.",
    "Lageret er strukturert. Foreløpig.",
    "Systempuls innenfor normale verdier.",
  ],

  warning: [
    "Flere varer mangler fortsatt plassering.",
    "Avvik eksisterer. De bare vises ikke enda.",
    "Lageret driver svakt ut av struktur.",
    "Ryddemodus anbefales.",
    "Systemet observerer økende avvik.",
  ],

  critical: [
    "Kritiske avvik krever oppmerksomhet.",
    "Flere forhold påvirker lagerkonsistens.",
    "Strukturavvik overstiger anbefalt nivå.",
    "Systemet anbefaler korrigerende arbeid.",
    "Operativ stabilitet er redusert.",
  ],

  structure: [
    "Lokasjoner brukes når lageret skal ryddes fysisk.",
    "Fast plassering gir roligere drift.",
    "Sonestruktur vurderes kontinuerlig.",
    "Struktur før hastighet.",
    "Snake overvåker lagerets form.",
  ],

  activity: [
    "Systemet overvåker. Ikke omvendt.",
    "Aktivitet registreres fortløpende.",
    "Endringer spores i sanntid.",
    "Snake følger bevegelsene i lageret.",
    "Arbeidsflyt vurderes kontinuerlig.",
  ],

  existential: [
    "Ingen bærer tirsdagen helt likt.",
    "Dagen står foreløpig inne for deler av seg selv.",
    "Det hjelper å stå litt skrått i store rom.",
    "Ingen feil registrert. Det er mistenkelig.",
    "Systemet er rolig. Det betyr ingenting.",
  ],
};

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function getSnakePulse(context?: PulseContext) {
  const {
    missingLocations = 0,
    quantityDiffs = 0,
    unresolvedIssues = 0,
    warehouseHealth = 100,
    pickEnabled = false,
  } = context || {};

  const categories: PulseCategory[] = [];

  // Kritisk drift
  if (
    quantityDiffs > 300 ||
    unresolvedIssues > 50 ||
    warehouseHealth < 40
  ) {
    categories.push("critical");
  }

  // Varsler / ting som bør ryddes
  if (
    missingLocations > 10 ||
    quantityDiffs > 50 ||
    unresolvedIssues > 10
  ) {
    categories.push("warning");
  }

  // Struktur og organisering
  if (!pickEnabled || missingLocations > 0) {
    categories.push("structure");
  }

  // Aktivitet/systemfølelse
  categories.push("activity");

  // Stabil drift
  if (
    warehouseHealth >= 80 &&
    quantityDiffs < 20 &&
    missingLocations < 5
  ) {
    categories.push("stable");
  }

  // Sjeldne eksistensielle meldinger
  if (Math.random() < 0.12) {
    categories.push("existential");
  }

  const selectedCategory = randomItem(categories);
  return randomItem(PULSES[selectedCategory]);
}