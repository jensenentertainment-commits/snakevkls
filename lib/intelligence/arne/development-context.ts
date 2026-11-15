export function getArneDevelopmentContext() {
  return {
    project: "Snake OS",
    purpose:
      "Outlet Service AS sin interne arbeidsplattform, med Varekompaniet som dagens operative brand og nettbutikk.",

    currentModules: [
      "Lager / Oversikt (standard startside)",
      "Produkter",
      "Lokasjoner",
      "Avvik",
      "Lokasjonstelling",
      "Aktivitet",
      "Børre",
      "Shopify / Roy",
      "Viper",
      "Snake Labs",
      "Innstillinger",
    ],

    knowledge: {
      reviewedOn: "2026-11-15",
      source: "Vedlikeholdt funksjonsbeskrivelse i kode, ikke en live driftskontroll.",
      limitations: "Ingen aktuelle lagertall, Health-score, Shopify-observasjoner, synkstatus eller aktøropplysninger er hentet til denne samtalen. Ukjent status er ikke null eller feil. Fysisk lagerregistrering er ikke bekreftet fullført.",
    },
    warehouseRules: [
      "Shopify Variant-ID er eneste automatiske koblingsnøkkel. Snake produkt-UUID er stabil intern identitet. SKU er valgfri og kan være duplisert; manglende SKU er ikke automatisk avvik.",
      "Flere lagerposter og plasseringer for samme vare er normalt. Registrert beholdning summeres over relevante poster. Nullbeholdning og tomme lokasjoner er ikke automatisk avvik.",
      "Positiv beholdning uten gyldig lokasjon er et registreringsforhold som trenger oppfølging, ikke alene en bekreftet fysisk lagerfeil.",
      "Shopify–Snake-forskjeller er observerte differanser, ikke bekreftede feil. Sammenligning krever kjent omfang, tidspunkt, ordre under behandling og status for fysisk lagerregistrering.",
      "Pakke A: Ren lokasjonsendring skriver ikke beholdningsantallet. Førstegangsregistrering og eksplisitt antallsendring er separate handlinger. Sonen følger konkret lokasjon. Ryddemodus er pensjonert; historikken er bevart.",
      "Pakke B: Én aktiv, varig telleøkt per lokasjon kan gjenopptas. Lagrede linjer overlever omlasting og ny innlogging. Serveren validerer lagrede linjer og tellegrunnlag ved fullføring, med samtidighets- og dobbeltfullføringsvern. Telling dokumenterer resultatet og justerer ikke beholdningen automatisk.",
    ],
    responsibilities: [
      "Arne er admins private koordinator og rådgiver. Han vurderer prioriteringer og arbeidsflyt, uten å utføre lagerendringer eller synkronisering.",
      "Børre svarer på lagerfaglige spørsmål fra sitt leselag, med forbehold om ufullstendig fysisk registrering.",
      "Roy leser lagrede katalogdata og viser arbeidsrapport og anbefalinger. Han skriver ikke til Shopify.",
      "Viper er et plukkverktøy for nettordre, ikke POS. Fullført plukk reduserer Snake-beholdning; Shopify-beholdning og fulfillment endres ikke av Viper. Praktisk produksjonspilot er ikke dokumentert fullført i dette kunnskapsgrunnlaget.",
      "Dashboard er skjult og videresender til Lager / Oversikt. Lagersalg er skjult fra navigasjonen; kode og historikk er beholdt.",
    ],

    principles: [
      "Bygg små, ferdige steg.",
      "Ikke bygg funksjoner før behovet er tydelig.",
      "Snake skal føles rolig, praktisk og ryddig.",
      "Børre skal føles som en lagerassistent, ikke som en AI-chat.",
      "Regular Børre hjelper med drift. Arne hjelper med utvikling.",
      "Unngå store omskrivinger uten god grunn.",
    ],
  };
}
