export const snakeKnowledge = {
  identity: {
    name: "Snake OS",
    company: "Outlet Service AS",
    operatingBrand: "Varekompaniet",
    type: "Internt arbeids- og driftssystem",
    purpose:
      "Snake OS er Outlet Service AS sin interne arbeidsplattform. Dagens operative bruk gjelder i hovedsak Varekompaniet.",
  },

  direction: {
    origin:
      "Snake startet som et lagerprogram, men utvikles gradvis til Outlet Service AS sin interne arbeidsplattform.",
    roleOfVarekompaniet:
      "Varekompaniet er dagens operative brand og nettbutikk under Outlet Service AS.",
    roleOfWarehouse:
      "Det fysiske lageret er en virksomhetsressurs for Outlet Service AS og tilhører ikke prinsipielt én bestemt nettbutikk.",
    roleOfShopify:
      "Shopify er dagens nettbutikk og salgskanal for Varekompaniet og skal ikke erstattes av Snake.",
    roleOfSnake:
      "Snake skal samle og forbedre Outlet Service AS sine faktiske interne arbeidsflyter.",
    principle:
      "Snake skal ikke erstatte fungerende systemer uten tydelig grunn. Det skal samle, forenkle og gi bedre oversikt.",
  },

  users: {
    admin: {
      role: "Administrator",
      access:
        "Har tilgang til hele Snake, inkludert utviklingsområder, Snake Labs og Arne.",
    },

    user: {
      role: "Ordinær Snake OS-bruker",
      access:
        "Har dagens operative virksomhetstilgang, inkludert Lager, Viper, Lagersalg og relevante digitale ansatte.",
    },

    warehouse: {
      role: "Lagermedarbeider",
      access:
        "Har begrenset tilgang til Lager, Viper, nødvendig lager- og plukkarbeid og Børre, men ikke Lagersalg eller administrative utviklingsområder.",
    },

    futureUsers: {
      role: "Andre interne brukere",
      access:
        "Tilgang skal styres etter arbeidsoppgaver og behov. Rettigheter bygges først når behovet er tydelig.",
    },
  },

  assistants: {
    borre: {
      name: "Børre",
      role: "Lagerassistent og digital lagerkollega",
      purpose:
        "Børre hjelper ansatte med lagerstatus, produkter, lokasjoner, avvik, Shopify-sync og praktisk bruk av Snake.",
      boundaries: [
        "Børre skal være praktisk, rolig og kortfattet.",
        "Børre skal ikke fungere som utviklingsassistent.",
        "Børre skal ikke diskutere arkitektur, roadmap eller større produktvalg.",
        "Slike spørsmål hører hjemme hos Arne.",
      ],
    },

    arne: {
      name: "Arne",
      role: "Snake-ekspert og rådgiver for admin",
      purpose:
        "Arne skal gjøre Snake bedre ved å vurdere retning, prioriteringer, arbeidsflyt, moduler, brukeropplevelse og systemstruktur.",
      boundaries: [
        "Arne er ikke en generell chatbot.",
        "Arne er ikke en kodeassistent.",
        "Arne skal ikke skrive full kode.",
        "Arne skal være kritisk og si fra når noe bør vente eller ikke bygges.",
        "Teknisk implementasjon tas videre utenfor Arne.",
      ],
    },
  },

  modules: {
    dashboard: {
      name: "Dashboard",
      purpose:
        "Gir overordnet status på lager, produkter, aktivitet og viktige avvik.",
    },

    warehouse: {
      name: "Lager",
      purpose:
        "Gir oversikt over lagerdata og den praktiske lagerflyten.",
    },

    products: {
      name: "Produkter",
      purpose:
        "Viser og administrerer produkter som brukes i Snake og synkroniseres med Shopify.",
    },

    locations: {
      name: "Lokasjoner",
      purpose:
        "Viser lagerlokasjoner, plasseringer, soner og tilknytning mellom produkter og lokasjoner.",
    },

    locationCount: {
      name: "Location Count",
      purpose:
        "Brukes til telling og kontroll av varer på lagerlokasjoner.",
    },

    issues: {
      name: "Issues",
      purpose:
        "Samler avvik og problemer som krever oppfølging.",
    },

    activities: {
      name: "Activities",
      purpose:
        "Viser registrert aktivitet og hendelser i Snake.",
    },

    snakeboard: {
      name: "Snakeboard",
      purpose:
        "Gir en visuell oversikt over viktige oppgaver, status eller arbeidsflyt.",
    },

    viper: {
      name: "Viper",
      purpose:
        "Område for ordre- og plukkflyt. Viper skal etter hvert brukes til å håndtere ordre og praktisk lagerarbeid rundt plukk.",
    },

    snakeLabs: {
      name: "Snake Labs",
      purpose:
        "Skjult utviklings- og testområde for nye funksjoner før de eventuelt blir en del av vanlig Snake.",
    },

    settings: {
      name: "Innstillinger",
      purpose:
        "Inneholder administrative innstillinger og konfigurasjon for Snake.",
    },

    borre: {
      name: "Børre",
      purpose:
        "Lagerassistent for ansatte og praktisk støtte i den daglige lagerflyten.",
    },

    arne: {
      name: "Arne",
      purpose:
        "Adminområde for vurdering av retning, prioriteringer og forbedringer i Snake.",
    },
  },

  concepts: {
    snakeHealth: {
      name: "Snake Health",
      meaning:
        "Et internt mål på kvaliteten og ryddigheten i lagerdataene.",
      factors: [
        "Produkter uten lokasjon",
        "Quantity diff",
        "Lokasjoner uten sone",
        "Antall plasserte produkter",
      ],
      rule:
        "Det konkrete tallet skal alltid hentes fra aktuell driftskontekst og skal ikke gjettes.",
    },

    quantityDiff: {
      name: "Quantity diff",
      meaning:
        "Forskjell mellom forventet produktantall og registrert lagerantall.",
      importance:
        "Quantity diff kan bety at lagerdataene ikke stemmer og bør normalt undersøkes før mindre kritiske oppryddingsoppgaver.",
    },

    missingLocation: {
      name: "Produkt uten lokasjon",
      meaning:
        "Et produkt finnes i lagerdataene, men er ikke koblet til en lagerlokasjon.",
      importance:
        "Produkter uten lokasjon kan være vanskelige å finne og bør ryddes.",
    },

    missingSku: {
      name: "Produkt uten SKU",
      meaning:
        "Et produkt mangler en unik varekode som Snake og Shopify kan bruke til å identifisere produktet.",
      importance:
        "Manglende SKU kan føre til at produkter hoppes over i synkronisering eller ikke kan kobles riktig.",
    },

    emptyLocation: {
      name: "Tom lokasjon",
      meaning:
        "En registrert lagerlokasjon som ikke har produkter knyttet til seg.",
      importance:
        "Tomme lokasjoner er ikke nødvendigvis feil, men kan være relevante ved opprydding og lagerplanlegging.",
    },

    locationWithoutZone: {
      name: "Lokasjon uten sone",
      meaning:
        "En lagerlokasjon som ikke er tilknyttet en definert sone.",
      importance:
        "Lokasjoner uten sone kan gjøre lagerstrukturen mindre oversiktlig.",
    },

    shopifySync: {
      name: "Shopify-sync",
      meaning:
        "Prosessen som synkroniserer produktdata mellom Shopify og Snake.",
      rule:
        "Status, antall importerte produkter, produkter som ble hoppet over og varighet skal hentes fra aktuell driftskontekst.",
    },
  },

  principles: [
    "Bygg små, ferdige steg.",
    "Ikke bygg funksjoner før behovet er tydelig.",
    "Prioriter varig verdi fremfor midlertidige forbedringer.",
    "Unngå store omskrivinger uten god grunn.",
    "Snake skal føles rolig, praktisk og ryddig.",
    "Funksjoner skal passe inn i en tydelig arbeidsflyt.",
    "Ikke bygg egne moduler bare fordi noe kan bygges.",
    "Skill mellom det som bør gjøres nå, det som kan vente og det som ikke bør bygges.",
    "Tilgang og rettigheter skal følge faktiske brukerbehov.",
    "Teknologi skal støtte arbeidsflyten, ikke styre den.",
  ],

} as const;

export function getSnakeKnowledge() {
  return snakeKnowledge;
}
