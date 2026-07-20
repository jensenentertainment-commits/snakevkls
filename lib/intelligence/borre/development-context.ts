export function getBorreDevelopmentContext() {
  return {
    project: "Snake OS",
    purpose:
      "Internt lager- og driftssystem for Varekompaniet. Snake skal etter hvert flytte arbeidsflyt bort fra Shopify der det gir mening.",

    currentStatus: {
      phase: "Under utvikling",
      users: "Foreløpig hovedsakelig admin. Andre brukere skal først inn når Snake er klart.",
      mainFocus: "Regular Børre, lagerstatus og etter hvert ordre/plukk.",
    },

    currentModules: [
      "Dashboard",
      "Lager",
      "Produkter",
      "Lokasjoner",
      "Issues",
      "Activities",
      "Børre",
      "Viper",
      "Snake Labs",
      "Innstillinger",
    ],

    plannedModules: [
      "Ordre/plukk",
      "Kundeservice",
      "E-post i Snake",
      "Nettbutikk-chat koblet til Snake",
      "Arne",
    ],

    principles: [
      "Bygg små, ferdige steg.",
      "Ikke bygg funksjoner før behovet er tydelig.",
      "Snake skal føles rolig, praktisk og ryddig.",
      "Børre skal føles som en lagerassistent, ikke som en AI-chat.",
      "Regular Børre hjelper med drift. Arne hjelper med utvikling.",
      "Unngå store omskrivinger uten god grunn.",
    ],

    currentSprint: [
      "Rydde Børre-struktur i egne filer.",
      "Bruke felles Børre-context.",
      "Gjøre Regular Børre ferdig før Arne bygges fullt ut.",
    ],

    nextLikelyWork: [
      "Quantity diff-liste i Børre.",
      "Produkter uten SKU i Børre.",
      "Tomme lokasjoner i Børre.",
      "Sidebevissthet i Børre.",
      "Viper ordre/plukk.",
    ],
  };
}