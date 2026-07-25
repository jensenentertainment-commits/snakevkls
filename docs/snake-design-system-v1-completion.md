# Snake Design System v1 – ferdigstillelse

Design System v1 og Lager-piloten er ferdigstilt gjennom Commit 1–5. Det
offentlige API-et består av canonical CSS-tokens, Tailwind-eksponeringen,
primitive-komponentene og layout-/navigasjonskomponentene. Compatibility-
aliaser og legacy-radiusverdier beholdes mens øvrige moduler migreres.

## Lager-pilot

Lager bruker nå:

- `AppShell`, `AppNavbar` og `ModuleNav` for global og lokal navigasjon
- canonical farge-, radius-, border- og shadow-tokens i alle Lager-flater
- `LagerHero`, `LagerToolbar` og `LagerDropdown` som Lager-avgrensede
  adaptere over det frosne fundamentet
- `LagerViewTabs` for visningsvalg med pil-, Home- og End-navigasjon
- Design System-primitives for status og fremdrift der kontrakten dekker
  behovet

Tabs representerer bare visninger. Toolbar inneholder filtre og handlinger.
Ruter, datalasting, arbeidsflyter og forretningslogikk er uendret.

## Bevisste unntak

- Lagerets modaler og enkelte arbeidsflytknapper er fortsatt lokale. De har
  formtilstand, validering eller responsiv plassering som ikke dekkes av de
  frosne primitive-kontraktene. De bruker canonical tokens og skal ikke
  presses inn i en primitive før en modal-/formkontrakt er designet.
- Produktbilder bruker fortsatt vanlig `img`. En overgang til `next/image`
  krever en egen beslutning om eksterne bildekilder og kan endre lasting.
- QR- og etikettutskrift beholder fysisk svart/hvitt-utdata. Dette er et
  utskriftskrav for skannerkontrast, ikke en alternativ skjermpalett.
- `SnakeHero`, `SnakeToolbar` og `SnakeDropdown` slettes ikke globalt fordi
  ikke-migrerte moduler fortsatt bruker dem. Lager importerer dem ikke lenger.
- Børre er fortsatt en midlertidig global løsning. Digital Workforce er
  uttrykkelig utenfor Design System v1.

## Tilgjengelighetskontrakt

- Interaktive elementer har synlig `focus-visible`-markering.
- Lager-tabs bruker `tablist`/`tab`, roving `tabIndex`, `aria-selected` og
  tastene Pil venstre, Pil høyre, Home og End.
- Native select beholdes for filtre og gir innebygd tastaturstøtte.
- Fremdrift bruker `role="progressbar"` med verdi, minimum og maksimum.
- Semantiske tekst-/bakgrunnspar er kontrollert mot WCAG AA. Ren
  svart/hvitt-kontrast på etiketter er beholdt for utskrift.

## Videre forvaltning

Design System v1 kan fryses etter grønn kontrakttest, lint, TypeScript og
produksjonsbuild. Neste fase skal være separat og velge én ny modul; Dashboard,
Viper og Digital Workforce inngår ikke i Lager-piloten.
