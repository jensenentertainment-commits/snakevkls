# Snake Design System v1 — fundamentplan

Dato: 24.07.2026  
Status: Foreslått for godkjenning  
Forutsetning: Ingen full migrering eller sideendring i denne fasen  
Grunnlag: `snake-design-system-v1-rapport.md`, eksisterende frontend og adminskjermbilder

## 1. Beslutningssammendrag

Fundamentet bygges som en kompatibel utvidelse av dagens uttrykk:

- Petrol, Snake-blå, lys arbeidsflate og Geist beholdes.
- Gull avgrenses til merkevare, aktiv navigasjon og små aksenter. Gull skal ikke lenger være generell warning eller fylt CTA med hvit tekst.
- Status får egne semantiske familier: success, warning, danger, info og neutral.
- Radius reduseres til seks roller.
- Spacing fortsetter på 4 px-basert skala.
- Borders og shadows får navngitte nivåer.
- Globale tokens etableres som CSS custom properties og eksponeres til Tailwind v4 via `@theme inline`.
- Gamle variabelnavn beholdes midlertidig som aliaser.
- Eksisterende hardkodede klasser endres ikke i tokenfasen. De migreres én komponent eller side om gangen.
- En ny global navbar skal inneholde dato og klokkeslett. Den tidligere globale footeren fjernes.
- Lager blir første pilotside etter at tokens og grunnkomponenter er på plass.
- Viper P1–P3 forblir på pause og inngår ikke i piloten.

## 2. Arkitekturvalg

### 2.1 Stylingmodell

Snake Design System v1 bruker:

1. `app/globals.css` for reset, fontgrunnlag og globale tokens.
2. Tailwind v4 utilities koblet til semantiske tokens.
3. Delte React-komponenter for repeterte visuelle kontrakter.
4. CSS Modules bare når en komponent krever CSS som blir uleselig eller upraktisk i Tailwind, for eksempel kompliserte printregler.

Dette følger prosjektets Next.js 16-oppsett. Global CSS holdes virkelig global; komponentstyling skal ikke legges som mange globale klasser.

### 2.2 Server- og klientgrenser

- Layout, statiske navlenker, sideframes og kort er Server Components som standard.
- Interaktive primitives blir Client Components bare når de faktisk trenger events eller state.
- Klokke, profilmeny, dropdown, modal og mobilmeny blir små klientøyer.
- Datahenting flyttes ikke som del av designarbeidet.
- Eksisterende route-struktur endres ikke i tokenfasen.

### 2.3 Foreslått filstruktur

```text
app/
  globals.css
  components/
    design-system/
      Button.tsx
      IconButton.tsx
      Badge.tsx
      StatusBadge.tsx
      TextField.tsx
      SearchField.tsx
      Select.tsx
      Checkbox.tsx
      FormField.tsx
      Card.tsx
      Surface.tsx
      EmptyState.tsx
      Progress.tsx
      Modal.tsx
      Tabs.tsx
      index.ts
    layout/
      AppShell.tsx
      AppNavbar.tsx
      AppNavLinks.tsx
      AppClock.tsx
      AppUserMenu.tsx
      MobileNav.tsx
      ModuleNav.tsx
      ModuleNavMobile.tsx
      PageFrame.tsx
      PageHero.tsx
      PageToolbar.tsx
    navigation/
      modules.ts
      types.ts
    lager/
      LagerHero.tsx
      LagerModuleCard.tsx
      LagerWideCard.tsx
```

Produktspesifikke komponenter skal ikke flyttes inn i `design-system`. Designsystemet eier primitive kontrakter; Lager eier lagerinnhold og arbeidslogikk.

## 3. Endelig fargepalett

### 3.1 Kjerne- og overflatefarger

| Token | Verdi | Bruk |
|---|---|---|
| `--snake-color-app` | `#062f3b` | Global appbakgrunn |
| `--snake-color-app-elevated` | `#083844` | Navbar, mørke hevede flater |
| `--snake-color-app-deep` | `#031f26` | Overlaytekst, mørk kontrast, dyp bakgrunn |
| `--snake-color-hero` | `#05495b` | Operativ hero |
| `--snake-color-workspace` | `#e8eef0` | Lys arbeidsflate |
| `--snake-color-surface` | `#ffffff` | Kort, tabeller, modal |
| `--snake-color-surface-subtle` | `#f6f7f8` | Inputs, sekundærflate, empty state |
| `--snake-color-surface-warm` | `#fff7e8` | Warningflate |
| `--snake-color-overlay` | `rgb(3 31 38 / 72%)` | Modal/drawer-overlay |

### 3.2 Tekst

| Token | Verdi | Bruk |
|---|---|---|
| `--snake-color-text-on-dark` | `#f4f1e8` | Primærtekst på petrol |
| `--snake-color-text-on-dark-muted` | `#b6c7ca` | Sekundærtekst på petrol |
| `--snake-color-text-primary` | `#0a0a0a` | Primærtekst på lys flate |
| `--snake-color-text-secondary` | `#525252` | Brødtekst/sekundærtekst |
| `--snake-color-text-muted` | `#737373` | Metadata |
| `--snake-color-text-disabled` | `#a3a3a3` | Disabled tekst |
| `--snake-color-link` | `#055a7d` | Lenker og teksthandlinger |

`#737373` på hvitt gir omtrent 4,74:1. Det er nedre normaltekstnivå og skal ikke lysnes ytterligere for små tekster.

### 3.3 Handling og fokus

| Token | Verdi | Bruk |
|---|---|---|
| `--snake-color-action-primary` | `#055a7d` | Primærknapp |
| `--snake-color-action-primary-hover` | `#044b68` | Primær hover |
| `--snake-color-action-primary-pressed` | `#033f59` | Primær pressed |
| `--snake-color-action-primary-text` | `#ffffff` | Tekst på primær |
| `--snake-color-focus` | `#2d9dcc` | Fokus-ring |
| `--snake-color-focus-soft` | `rgb(45 157 204 / 24%)` | Ytre fokus-ring |

`#055a7d` med hvit tekst gir omtrent 7,59:1 og beholdes som systemets tydelige handlingsfarge.

### 3.4 Brand og gull

| Token | Verdi | Bruk |
|---|---|---|
| `--snake-color-brand-gold` | `#b58a14` | Aktiv navkant, logoaksent, små indikatorer |
| `--snake-color-brand-gold-strong` | `#a77e04` | Gull på lyse flater |
| `--snake-color-brand-gold-soft` | `rgb(181 138 20 / 14%)` | Aktiv/valgt bakgrunn |
| `--snake-color-brand-gold-border` | `rgb(181 138 20 / 42%)` | Aktiv kant |

### 3.5 Status

| Rolle | Surface | Border | Text/icon |
|---|---|---|---|
| Success | `#ecfdf5` | `#a7f3d0` | `#14565b` |
| Warning | `#fff7e8` | `#f3d38a` | `#8a6704` |
| Danger | `#fff1f1` | `#fecaca` | `#9f3f3f` |
| Info | `#edf7fb` | `#b8dce9` | `#055a7d` |
| Neutral | `#f5f5f5` | `#d4d4d4` | `#525252` |

Statusverdiene bygger på farger som allerede finnes i appen, men samler dem til én kontrakt.

### 3.6 Labs og sonekategorier

- Labs beholder violet som kategorifarge, ikke statusfarge.
- Sonefarger behandles som kategorier og skal aldri gjenbruke danger/success-semantikk uten at status også uttrykkes med tekst.
- Endelig sonepalett utsettes til lagerstrukturens datamodell og antall sonetyper er avklart.
- V1 oppretter foreløpig bare `--snake-color-category-labs-*`.

## 4. Hvilke eksisterende farger beholdes

### Beholdes uendret

- `#062f3b` — appbakgrunn
- `#031f26` — dyp petrol
- `#05495b` — hero
- `#e8eef0` — workspace
- `#055a7d` — primær handling og link
- `#044b68` — én autoritativ primær hover
- `#b58a14` — brand gold
- `#a77e04` — brand gold strong
- `#14565b` — success text/icon
- `#8a6704` — warning text/icon
- `#9f3f3f` — danger text/icon
- `#f4f1e8` — tekst på mørk flate

### Slås sammen

- `#a77e05` → `#a77e04`
- `#044c6a` og `#04495f` → `#044b68`
- green/emerald-varianter → status.success-familien
- amber og gull brukt som warning → status.warning-familien
- Tailwind red og `#b45454` brukt som danger → status.danger-familien
- `#fbf6e8` → `#fff7e8`

### Beholdes bare lokalt eller fases ut

- `#003b46` fases ut til appbakgrunn.
- Labs-mørkfarger beholdes midlertidig inne i Labs, men får ikke globale roller.
- Gradientstoppene i avatar/logo kan beholdes som komponentinterne branddetaljer.
- `#d5dee2` fases ut til standard border token.
- Cyan/sky i «live»-kort erstattes av info eller en dokumentert live-variant.

## 5. Avgrensning av gull

Gull skal bety «Snake-identitet eller nåværende kontekst», ikke «vær forsiktig».

### Gull kan brukes til

- aktiv hovednavigasjon som border, indikator eller svak bakgrunn
- Snake/Børre-eyebrow og merkevaretekst
- dekorativ linje eller liten statusdot uten operasjonell semantikk
- valgt brandtab når valget ikke er warning
- logo- og avataraksenter

### Gull skal ikke brukes til

- danger eller warning
- standard primærknapp
- suksess
- disabled
- store fylte flater med hvit normaltekst

Hvit tekst på `#b58a14` har omtrent 3,18:1 og er ikke godkjent for normal tekst. Hvis en sjelden gullfylt merkevareknapp beholdes, skal den bruke mørk tekst (`#031f26`, omtrent 5,38:1), men standarden er blå primærknapp.

## 6. Radius-skala

| Token | Verdi | Bruk |
|---|---:|---|
| `--snake-radius-sm` | 8 px | Små interne kontroller |
| `--snake-radius-control` | 12 px | Compact button/select |
| `--snake-radius-action` | 16 px | Standard button/input |
| `--snake-radius-card` | 24 px | Kort og indre panel |
| `--snake-radius-panel` | 28 px | Modal, drawer, større panel |
| `--snake-radius-shell` | 32 px | Hovedarbeidsflate |
| `--snake-radius-pill` | 9999 px | Badge, nav, avatar |

Migreringsregel:

- 22 og 24 px → card
- 26 px → card eller panel basert på størrelse
- 28 px → panel
- 32 px → shell
- `rounded-2xl` beholdes som action
- `rounded-3xl` mappes til card

Eksisterende `--snake-card-radius`, `--snake-panel-radius` og `--snake-control-radius` blir aliaser i overgangsfasen.

## 7. Spacing-skala

Skalaen beholder Tailwinds 4 px-grunnlag:

| Token | Verdi |
|---|---:|
| `--snake-space-0` | 0 |
| `--snake-space-1` | 4 px |
| `--snake-space-2` | 8 px |
| `--snake-space-3` | 12 px |
| `--snake-space-4` | 16 px |
| `--snake-space-5` | 20 px |
| `--snake-space-6` | 24 px |
| `--snake-space-8` | 32 px |
| `--snake-space-10` | 40 px |
| `--snake-space-12` | 48 px |
| `--snake-space-16` | 64 px |

Komponentroller:

- compact control: 8 px vertikalt / 12 px horisontalt
- standard control: 12 px vertikalt / 16 px horisontalt
- large control: 16 px vertikalt / 20 px horisontalt
- card padding: 20 eller 24 px
- panel padding: 24 eller 32 px
- section gap: 24, 32 eller 40 px
- page gutter: 16 px mobil, 24 px tablet, 32 px desktop
- app shell max-width: 1440 px
- wide data max-width: 1600 px, kun eksplisitt variant

Spacing-tokens brukes for dokumentasjon og komponent-CSS. Vanlige Tailwind-klasser (`p-4`, `gap-6`) forblir tillatt fordi de allerede følger samme skala.

## 8. Border-nivåer

| Token | Lys flate | Mørk flate | Rolle |
|---|---|---|---|
| `border.subtle` | `rgb(10 10 10 / 10%)` | `rgb(255 255 255 / 8%)` | Kort, seksjon |
| `border.default` | `#d4d4d4` | `rgb(255 255 255 / 12%)` | Inputs, tabeller |
| `border.strong` | `#a3a3a3` | `rgb(255 255 255 / 22%)` | Tydelig skille |
| `border.focus` | `#2d9dcc` | `#62b9dc` | Fokus |
| `border.selected` | `rgb(181 138 20 / 42%)` | samme | Aktiv nav/brandvalg |

Regler:

- Borders skal bruke token etter rolle, ikke «black/10 eller neutral-200 etter smak».
- Fokus skal være separat fra selected.
- Statuskomponenter bruker statusens egen border.
- Dashes brukes bare for dropzone eller empty state, ikke standardkort.

## 9. Shadow- og elevationnivåer

| Token | Verdi/karakter | Bruk |
|---|---|---|
| `--snake-shadow-none` | `none` | Tabellrad, flat seksjon |
| `--snake-shadow-card` | `0 1px 2px rgb(3 31 38 / 10%)` | Standardkort |
| `--snake-shadow-panel` | `0 10px 30px rgb(3 31 38 / 16%)` | Dropdown, sticky actionbar |
| `--snake-shadow-overlay` | `0 24px 72px rgb(0 0 0 / 32%)` | Modal/drawer |
| `--snake-shadow-glass` | `0 18px 60px rgb(0 0 0 / 22%)` | Dashboard/login-only |

Hover skal normalt endre border og eventuelt bruke `panel`; egne røde/grønne hover-shadows fases ut.

## 10. Teksthierarki

Font:

- Geist Sans for UI og brødtekst.
- Geist Mono for SKU, lokasjonskode, måleverdier, tellinger og tidsstempel når det bedrer skannbarhet.

| Stil | Størrelse/linje | Vekt | Bruk |
|---|---|---:|---|
| `display-page` | 42/44 desktop, 32/36 mobil | 600 | Sidetittel |
| `heading-section` | 28/34 | 600 | Seksjon |
| `heading-card` | 20/28 | 600 | Kort |
| `heading-compact` | 16/24 | 600 | Liste-/paneltittel |
| `body-default` | 16/24 | 400 | Hovedtekst |
| `body-small` | 14/22 | 400 | Standard UI-tekst |
| `label-control` | 12/16 | 600 | Feltlabel |
| `label-eyebrow` | 11/16, uppercase, 0.16 em | 600 | Hero/brand eyebrow |
| `label-table` | 11/16, uppercase, 0.12 em | 600 | Tabellhode |
| `meta` | 12/18 | 400/500 | Tid, actor, sekundærdata |
| `metric` | 28/32 | 650 | Statistikk |

Regler:

- Én `h1` per side.
- Hver side skal ha unik metadata-title og beskrivende `h1`, slik at Next.js route announcement fungerer.
- `font-black` brukes ikke som standard UI-vekt.
- Uppercase brukes til korte labels, ikke handlingsknapper eller brødtekst.
- Brødtekst under 14 px unngås.

## 11. Felles komponenter

### 11.1 Grunnkomponenter som opprettes først

#### `Button`

Varianter:

- `primary`
- `secondary`
- `ghost`
- `danger`
- `brand` kun ved eksplisitt merkevarebehov

Størrelser: `sm`, `md`, `lg`.  
Tilstander: default, hover, pressed, focus-visible, loading, disabled.  
Kan rendres som button eller via en enkel polymorf link-kontrakt.

#### `IconButton`

- Samme tonesystem som Button.
- Krever tilgjengelig navn.
- Størrelser 36, 40 og 48 px.

#### `Badge` og `StatusBadge`

- Badge: neutral, info, category, brand.
- StatusBadge: success, warning, danger, info, neutral.
- StatusBadge krever tekst; ikon er valgfritt.
- Count er en eksplisitt prop, ikke del av labelstring.

#### `FormField`

Samler label, hint, error, required og control-id.

#### `TextField`, `SearchField`, `Select`, `Checkbox`

- `sm`, `md`, `lg`.
- light og dark context bare når nødvendig.
- Felles focus-visible og error.
- Native select kan brukes bak samme visuelle API i v1.

#### `Card` og `Surface`

Card-varianter:

- `default`
- `subtle`
- `interactive`
- `selected`
- `disabled`
- `status`

Surface brukes for større layoutflater og har `workspace`, `card`, `dark` og `glass`.

#### `EmptyState`, `Progress`, `Tabs`

- EmptyState standardiserer ikon, tittel, beskrivelse og valgfri handling.
- Progress har label, verdi og tilgjengelig verdi.
- Tabs støtter filtertab med count og route/tab-variant.

#### `Modal`

- Samler overlay, focus trap, Escape, aria-labeling, mobil bottom-sheet og desktopdialog.
- `CreateLocationModal` og `ZoneModal` bruker denne etter pilotens grunnkomponentfase.
- Modalens innhold forblir domeneeid.

### 11.2 Layoutkomponenter

- `AppShell`: global bakgrunn, page gutter og maks bredde.
- `AppNavbar`: desktop/mobile struktur.
- `PageFrame`: shell-radius, workspace og elevation.
- `PageHero`: eyebrow, h1, description, back action og høyre slot.
- `PageToolbar`: filtre og handlinger.
- `SectionHeader`: label, tittel, beskrivelse og action.

### 11.3 Ikke i første leveranse

- Full DataTable-abstraksjon.
- Generisk ModuleCard for hele appen.
- Komplett sonekategoripalett.
- Børre-chat redesign.
- Viper-komponentmigrering.

## 12. Alias- og overgangsstrategi

### 12.1 Prinsipp

Ingen eksisterende side skal brekke når tokens innføres. Nye canonical tokens opprettes først. Eksisterende variabler peker deretter til canonical tokens.

Eksempel på planlagt aliasmodell:

```css
:root {
  --snake-color-app: #062f3b;
  --snake-color-action-primary: #055a7d;
  --snake-color-brand-gold: #b58a14;
  --snake-radius-card: 24px;
  --snake-radius-panel: 28px;
  --snake-radius-action: 16px;

  /* Deprecated compatibility aliases */
  --background: var(--snake-color-app);
  --foreground: var(--snake-color-text-on-dark);
  --vk-blue: var(--snake-color-action-primary);
  --vk-gold: var(--snake-color-brand-gold-strong);
  --vk-gold-bright: var(--snake-color-brand-gold);
  --snake-bg: var(--snake-color-app);
  --snake-panel: var(--snake-color-workspace);
  --snake-hero: var(--snake-color-hero);
  --snake-card-radius: var(--snake-radius-card);
  --snake-panel-radius: var(--snake-radius-panel);
  --snake-control-radius: var(--snake-radius-action);
}
```

`--vk-blue-soft` og `--vk-muted-blue` beholdes som alias til samme legacyverdi inntil bruk er avklart, men skal merkes deprecated.

### 12.2 Tailwind v4-eksponering

Canonical tokens eksponeres som semantiske utilities:

```css
@theme inline {
  --color-snake-app: var(--snake-color-app);
  --color-snake-hero: var(--snake-color-hero);
  --color-snake-workspace: var(--snake-color-workspace);
  --color-snake-primary: var(--snake-color-action-primary);
  --color-snake-brand: var(--snake-color-brand-gold);
}
```

Målet er klasser som `bg-snake-app`, `text-snake-primary` og `border-snake-*`, ikke arbitrary hex.

Fontmapping verifiseres særskilt mot Tailwind v4/Geist under implementeringen. Det skal ikke gjøres en fontrefaktor samtidig med fargetoken-commit hvis den gir uventede typografiske endringer.

### 12.3 Deprecation

- Aliasene fjernes ikke i v1-piloten.
- En kommentarblokk i `globals.css` lister deprecated aliases.
- Nye filer tillates ikke å bruke deprecated aliases eller hardkodede brand/statusverdier.
- Aliasfjerning planlegges først når `rg` viser null aktive brukere.

## 13. Gradvis migrering av hardkodede verdier

### Trinn A — inventar og guardrail

1. Lag maskinlesbar liste over forbudte nye hexverdier.
2. Registrer baselineantall for de viktigste fargene.
3. Innfør en enkel CI-sjekk som feiler bare ved netto nye forekomster, ikke på eksisterende gjeld.
4. Genererte filer, print-QR og tredjepartsdata unntas eksplisitt.

### Trinn B — nye komponenter

- Alle nye design-systemkomponenter bruker canonical tokens.
- Ingen gammel side endres bare for å «rydde tall».
- Visuell likhet verifiseres før komponenten tas i bruk.

### Trinn C — komponentvis migrering

Rekkefølge:

1. Button/links.
2. Badge/status.
3. Inputs/select.
4. Card/surface.
5. Modal.
6. Navbar/layout.

Et mønster migreres ferdig på pilotsiden før samme mønster rulles ut bredt.

### Trinn D — sidevis migrering

Lager → Produkter → Lokasjoner → Avvik → Telling/Ryddemodus → øvrige sider → Viper sist.

### Trinn E — opprydding

- Fjern ubrukte lokale variantkart.
- Fjern deprecated aliases når bruken er null.
- Stram CI fra «ingen økning» til «ingen hardkodede designfarger».

## 14. Ny global navbar med dato og klokkeslett

### 14.1 Informasjonsarkitektur

Desktopnavbar deles i tre soner:

1. **Brand og tid**
   - kompakt Varekompaniet/Snake-logo
   - `SNAKE OS`
   - dato og klokkeslett på to linjer eller `fre. 24. jul · 21:18`

2. **Global modulnavigasjon**
   - Dashboard
   - Lager
   - Viper
   - eventuelle fremtidige toppnivåmoduler

   Produkter, Lokasjoner, Ryddemodus, Avvik, Telling og Aktivitet flyttes ut
   av global navigasjon og inn i Lager sin lokale modulnavbar. Global navbar
   skal svare på «hvor i Snake er jeg?», ikke vise alle arbeidsområder i alle
   moduler.

3. **Verktøy og bruker**
   - Børre
   - adminmeny som samler Innstillinger og Labs
   - profil/avatar
   - mobilmenytrigger på smal skjerm

Labs og Innstillinger flyttes inn i en adminmeny for å redusere bredden. Børre
beholder synlig inngang. Viper forblir synlig som toppnivåmodul, men migreres
ikke utover global navbar mens Viper er på pause.

### 14.2 Responsiv oppførsel

- `>= 1280 px`: full navtekst.
- `1024–1279 px`: verktøy samles, enkelte sekundære labels kan skjules, men primærnav er tilgjengelig.
- `< 1024 px`: hamburger/Sheet med alle lenker, rollemerking og profilhandlinger.
- Ingen horisontal viewport-scroll.
- Aktiv route uttrykkes med tekst, kontrast og indikator; ikke bare gullfarge.

### 14.3 Dato og klokke

- Renderes i `AppClock` som liten Client Component.
- Initial servermarkup viser stabil placeholder eller kun dato for å unngå hydration mismatch.
- Etter mount brukes `Intl.DateTimeFormat("no-NO", ...)`.
- Oppdateres ved neste minuttgrense og deretter hvert 60. sekund.
- Sekunder vises ikke.
- Tidssone er lokal nettlesertid; dette passer lagerterminalene i Norge. Hvis sentral tid kreves senere, kan `Europe/Oslo` låses.
- `aria-live` brukes ikke på klokken, slik at skjermlesere ikke annonserer hvert minutt.
- `<time dateTime>` brukes når klientverdien finnes.

### 14.4 Teknisk overgang

1. Ny `AppNavbar` og `ModuleNav` bygges side om side med `SnakeNav`.
2. Lagerpiloten bruker `AppNavbar` og Lager-konfigurert `ModuleNav`.
3. `SnakeNav` forblir urørt for øvrige sider.
4. Etter pilotgodkjenning erstattes `SnakeNav` sidevis eller gjennom et delt authenticated layout.
5. Først når alle aktuelle sider bruker `AppNavbar`, slettes `SnakeNav`.

Et felles authenticated route-group layout vurderes etter piloten. Å flytte alle sider til route groups samtidig med designsystempiloten gir for stor endringsflate.

## 15. Fjerning av global footer

### 15.1 Beslutning

`SnakeFooter` fjernes fra alle appskjermer. Informasjonen fordeles slik:

- dato/klokke → navbar
- Snake-pulse-tekst → beholdes der den har operasjonell verdi, for eksempel Lager-intelligence; ikke global pynt
- «Snake OS by Jensen Digital» → konto/om/systeminformasjon, ikke vedvarende footer

### 15.2 Overgang

1. Lagerpiloten rendrer ikke `SnakeFooter`.
2. Kontroller at innhold ikke brukte footer-margin som nødvendig bunnluft.
3. Legg standard bunnpadding i `AppShell`.
4. Etter pilotgodkjenning fjernes footerimport og rendering sidevis.
5. `SnakeFooter.tsx` slettes først når `rg` viser null imports.

Root layout rendrer ikke `SnakeFooter` i dag; «global» betyr her at den gjentas på nesten alle appskjermer. Fjerningen skal derfor gjøres kontrollert, sidevis.

## 16. Pilotplan for Lager

### 16.1 Mål

Validere at tokens, grunnkomponenter, navbar og footerfri shell fungerer på en representativ og operasjonelt viktig side uten å endre lagerfunksjonalitet eller datakall.

### 16.2 Omfang

Piloten inkluderer:

- `AppShell`
- `AppNavbar` med klokke
- ingen `SnakeFooter`
- workspace/surface/radius/shadow tokens
- Button, Badge/StatusBadge, Card, Progress og relevante layoutprimitives
- `LagerModuleCard` og `LagerWideCard` bygget på Card/Badge
- eksisterende `SnakeIntelligencePanel`, `SystemPulseBar` og `SnakeBoardPreview` visuelt tilpasset gjennom tokens der nødvendig
- responsiv layout og nav

Piloten inkluderer ikke:

- endring av queries, health-beregning eller modulrekkefølge
- ny funksjonalitet
- Børre-redesign
- ny sonefunksjonalitet
- Viper-endringer
- full DataTable

### 16.3 Implementeringssekvens

#### Commit 1 — tokens

- Legg til canonical tokens og legacy aliases.
- Eksponer semantiske Tailwind utilities.
- Ingen sideklasser endres.
- Verifiser at visuell baseline er uendret.

#### Commit 2 — grunnkomponenter

- Button, IconButton, Badge, StatusBadge, Card, Surface, Progress.
- Legg til isolerte component tests.
- Ingen eksisterende side migreres.

#### Commit 3 — layout og navbar

- AppShell, AppNavbar, AppClock, AppUserMenu og MobileNav.
- ModuleNav, ModuleNavMobile og første Lager-konfigurasjon.
- SnakeNav beholdes.
- Test global og lokal nav på rolle admin og lager.

#### Commit 4 — Lager-pilot

- Migrer `app/lager/page.tsx`.
- Vis Lager sin lokale modulnavbar mellom global navbar og sideinnhold.
- Behold data og linkmål.
- Fjern SnakeFooter bare på Lager.
- Ta visuelle snapshots.

#### Commit 5 — pilotjustering

- Kun feilretting fra QA, kontrast, responsivitet og komponent-API.
- Ingen utrulling til andre sider før eksplisitt godkjenning.

### 16.4 Visuelle akseptansekriterier

- Lager beholder dagens informasjonsarkitektur og Snake-identitet.
- Alle eksisterende modul- og vidkort er tilgjengelige med samme lenkemål.
- Global navbar viser toppnivåmodulen Lager som aktiv.
- Lokal navbar viser Lager-arbeidsområdene og riktig aktiv side.
- Kritisk/OK kan forstås uten bare farge.
- Primær handling er blå; gull er brand/aktiv.
- Ingen navbar-avkutting ved 1024, 1280, 1440 og 1920 px.
- Ingen horisontal scroll ved 375, 768, 1024 og 1440 px.
- Footer er borte uten at siden føles avkuttet.
- Børre-launcher dekker ikke kritiske handlinger.
- Fokusrekkefølge følger visuell rekkefølge.

## 17. Testplan

### 17.1 Statisk kvalitet

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- eksisterende `npm test`
- søk etter nye hardkodede farger i endrede filer
- søk etter imports av deprecated primitives i Lager

Produksjonsbuild er obligatorisk fordi Next.js kan ordne CSS annerledes i build enn i dev.

### 17.2 Komponenttester

For hver primitive:

- variant og størrelse
- disabled
- loading
- keyboard/focus-visible
- riktig elementtype og accessible name
- statuslabel
- form label/error-kobling

Eksisterende Node-testoppsett støtter ikke nødvendigvis DOM-komponenttester. Valg av React-testverktøy gjøres i implementeringssteget uten å erstatte dagens integrasjonstester.

### 17.3 E2E

Playwright foreslås for:

- innlogging som admin og lager
- alle navbarlenker
- aktiv route
- adminmeny bare for admin
- mobilmeny med tastatur
- profilmeny og logout
- Lager-kortlenker
- dato/klokke vises etter mount
- ingen console errors eller hydration warnings

Testene kjøres mot produksjonsbuild via Playwright `webServer`.

### 17.4 Visuell regresjon

Baseline og kandidatsnapshot:

- roller: admin og lager
- viewports: 375×812, 768×1024, 1024×768, 1440×900, 1920×1080
- sider i pilot: Lager
- states: normal, kritiske avvik, tom/rolig tilstand hvis fixtures tillater det
- navbar: admin/lager, desktop/mobile, meny åpen

Automatisk pixeldiff kombineres med manuell sjekk; tidsområdet maskeres eller fryses i snapshots.

### 17.5 Tilgjengelighet

- unik sidetittel og ett `h1`
- landmark: header/nav/main
- tastaturnavigasjon og Escape
- synlig focus-visible
- WCAG AA-kontrast
- 44×44 px minimum treffområde for primære touchhandlinger
- status uten kun farge
- reduced motion
- zoom 200 %
- skjermleser-rasktest av navbar, meny og Lager-kort

## 18. Rollbackplan

### 18.1 Tekniske sikkerhetsnett

- Hvert steg leveres som separat commit.
- Tokens er additive og legacy aliases beholdes.
- `SnakeNav` og `SnakeFooter` slettes ikke i piloten.
- Lager kan byttes tilbake til gammel shell uten å fjerne nye tokens/primitives.
- Ingen database-, API- eller datamodellendringer inngår.

### 18.2 Rollbacknivåer

1. **Komponentfeil:** Bytt Lager tilbake til tidligere komponent/import; behold tokens.
2. **Navbarfeil:** Bruk `SnakeNav` igjen på Lager; `AppNavbar` kan ligge ubrukt.
3. **Tokenfeil:** Endre canonical tokenverdi eller alias tilbake; gamle sider er fortsatt hardkodet.
4. **CSS/buildfeil:** Reverter tokencommit som egen enhet.
5. **Produksjonsproblem:** Reverter siste pilotcommit og deploy forrige grønne build.

### 18.3 Stop-kriterier

Piloten rulles ikke videre hvis:

- navbar mister handlinger for en rolle
- build eller eksisterende integrasjonstester feiler
- det oppstår hydration warnings
- Lager-lenker eller data endrer oppførsel
- kritisk kontrast eller tastaturflyt ikke består
- visuell regresjon viser utilsiktet endring utenfor Lager

## 19. Leveranser etter godkjenning

Første implementeringsrunde skal kun levere:

1. canonical tokens og compatibility aliases
2. grunnkomponentene definert i fase 1
3. AppShell/AppNavbar/AppClock med responsiv mobilnav
4. ModuleNav med Lager-konfigurasjon og responsiv mobilvariant
5. Lager som pilot
6. test- og snapshotoppsett nødvendig for piloten

Ingen andre sider migreres uten ny godkjenning etter pilotgjennomgang.

## 20. Godkjenningspunkter

Planen ber om eksplisitt godkjenning av disse beslutningene:

1. Gull reserveres for brand/aktiv kontekst og fjernes som generell CTA/warning.
2. Blå `#055a7d` er eneste standard primærhandling.
3. Warning bruker egen varm statusfamilie.
4. Radius er 8, 12, 16, 24, 28, 32 og pill.
5. Navbar samler Labs og Innstillinger i adminmeny.
6. Dato og minuttklokke flyttes til navbar.
7. SnakeFooter fjernes gradvis og pulsetekst blir kontekstuell.
8. Lager er eneste pilotside.
9. Route groups/authenticated layout utsettes til piloten er godkjent.
10. Aliasene beholdes gjennom v1-piloten og slettes først ved null bruk.
11. To-nivås navigasjon låses som fast layoutprinsipp for operative moduler.

## 21. Revisjon — to-nivås navigasjonsarkitektur

### 21.1 Anbefaling

To-nivås navigasjon bør låses som et fast layoutprinsipp i Snake Design System
v1:

1. **Global navbar:** hvilken Snake-modul brukeren befinner seg i.
2. **Lokal modulnavbar:** modulens arbeidsområder og route-navigasjon.
3. **Sideinnhold:** filtre, handlinger og selve arbeidet.

Prinsippet skal være fast, men den lokale navbaren er valgfri. En side skal
ikke få en tom eller kunstig andrelinje bare for å oppfylle layouten.

### 21.2 Støtter dagens kode og sidestruktur dette?

**Ja, med en adapterbasert overgang.** Dagens App Router-struktur har allerede
separate routes for arbeidsområdene og `usePathname` brukes til aktiv
navigasjon. `SnakeHero` og `SnakeToolbar` viser også at siden allerede har
visuelle lag som kan skilles fra navigasjonen.

Det som ikke finnes i dag:

- en eksplisitt modulmodell
- en delt lokal navbar
- et felles layoutskall som rendrer global og lokal nav i riktig rekkefølge
- et skille mellom route-navigasjon, tabs og sidehandlinger

Lager-arbeidsområdene ligger som toppnivåruter:

```text
/lager
/products
/locations
/fix-locations
/issues
/location-count
/activities
```

De kan derfor ikke automatisk arve `app/lager/layout.tsx` uten at URL-er eller
filstruktur flyttes. Slik flytting anbefales ikke i piloten. V1 bruker i stedet
en modulregistry som grupperer eksisterende routes logisk uten å endre URL.

Next.js nested layouts er fortsatt riktig langsiktig mekanisme der routes
faktisk deler et segment, eksempelvis Viper under `/viper/*`. De skal ikke
tvinges på Lager gjennom en samtidig rutemigrering.

### 21.3 Foreslått komponent- og layoutstruktur

```text
AppShell
├── AppNavbar
│   ├── Brand
│   ├── AppClock
│   ├── GlobalModuleLinks
│   ├── Børre
│   ├── AdminMenu
│   └── AppUserMenu
├── ModuleNav?                  valgfri
│   ├── ModuleIdentity
│   ├── ModuleRouteLinks
│   └── ModuleActions?         kun få, stabile handlinger
└── PageFrame
    ├── PageHero
    ├── PageToolbar?           filtre og sidehandlinger
    └── PageContent            selve arbeidet
```

Ansvarsdeling:

- `AppNavbar` kjenner toppnivåmoduler og rollebaserte globale verktøy.
- `ModuleNav` mottar en typed konfigurasjon og aktiv route.
- `PageToolbar` kjenner bare den aktuelle sidens filtre og handlinger.
- `Tabs` bytter datasett eller visning inne på samme route.
- Domeneinnhold kjenner ikke navbarimplementasjonen.

Foreslått konfigurasjon:

```text
ModuleDefinition
  id
  label
  homeHref
  matchRoutes
  items[]
    label
    href
    icon
    matchRoutes
    roles?
    badge?
```

Badge i modulnav skal bare vise stabil, nyttig operasjonell informasjon, for
eksempel uløste avvik. Den skal ikke brukes som erstatning for statuspanel.

### 21.4 Global og lokal informasjonsarkitektur

#### Global navbar

- Dashboard
- Lager
- Viper
- Børre som globalt verktøy
- samlet adminmeny
- profil
- dato og klokkeslett

Dashboardlenken kan ligge i brand/logo på bred desktop, men skal ha eksplisitt
tekst i mobilmenyen og tydelig tilgjengelig navn.

#### Lager modulnavbar

Anbefalt pilotkonfigurasjon:

- Oversikt → `/lager`
- Produkter → `/products`
- Lokasjoner → `/locations`
- Ryddemodus → `/fix-locations`
- Avvik → `/issues`
- Telling → `/location-count`
- Aktivitet → `/activities`

Snakeboard og etiketter er sekundære arbeidsflater:

- Snakeboard vises som handling eller kort fra Lager, ikke fast primærfane i
  første pilot.
- Etiketter nås fra Lokasjoner og beholder fokusert/printvennlig layout.

#### Viper modulnavbar

Planlegges, men implementeres ikke:

- Aktive plukk
- Avvik
- Historikk

Eksisterende `/viper/*`-struktur egner seg senere godt for `app/viper/layout.tsx`.
Viper forblir på pause.

### 21.5 Hvilke moduler trenger lokal navbar?

| Modul/flate | Lokal navbar | Begrunnelse |
|---|---|---|
| Dashboard | Nei | Oversikt og inngang, ikke en arbeidsmodul |
| Lager | Ja | Mange sidestilte operative arbeidsområder |
| Viper | Ja, senere | Egen arbeidsflyt med plukk, avvik og historikk |
| System/Innstillinger | Ja når migrert | Soner, brukere, konto-/systemområder må organiseres |
| Børre | Nei i v1 | Ett globalt assistentarbeidsområde |
| Labs | Nei i v1 | Få eksperimenter; kortgrid er tilstrekkelig |
| Konto | Nei | En enkel personlig flate |
| Innlogging | Nei | Utenfor authenticated app-shell |
| Changelog | Nei | En enkel informasjonsflate |
| Etiketter/print | Nei | Fokusert underflyt fra Lokasjoner |

En lokal navbar innføres først når modulen har minst to varige route-baserte
arbeidsområder. Midlertidige filtre er ikke grunn til å opprette den.

### 21.6 Mobilvisning

Global og lokal navigasjon skal ikke bli to åpne horisontale scrollfelt.

#### Global mobilnav

- Én tydelig menyknapp i global navbar.
- Sheet/drawer med Dashboard, Lager, Viper, Børre, admin og profil.
- Dato/klokke vises kompakt i drawer-header eller navbar.
- Aktiv toppnivåmodul markeres med tekst og indikator.

#### Lokal mobilnav

- Kompakt modulrad under global navbar.
- Viser modulnavn, aktivt arbeidsområde og en «Bytt område»-knapp.
- Knappen åpner et separat sheet eller dropdown med bare modulens routes.
- Sidehandlinger skal ikke legges i samme meny.
- Breadcrumb/tilbake brukes fortsatt på fokuserte underflyter.

Ved å skille global og lokal meny beholder brukeren mental kontekst: først
Snake-modul, deretter arbeidsområde.

### 21.7 Migrering av tabs, toolbars og sidemenyer

For å unngå duplisering får hvert kontrollnivå én rolle:

| Eksisterende mønster | Ny plassering |
|---|---|
| Globale lenker til Produkter/Lokasjoner/etc. | Lager `ModuleNav` |
| Route-baserte lokale lenker | `ModuleNav` |
| «Alle / Mangler / Har sone» | `Tabs` i sideinnhold |
| Søk, collection- og sonefilter | `PageToolbar` |
| «Ny lokasjon», «Sync Shopify», «Print labels» | `PageToolbar` eller hero action |
| Inline radhandlinger | DataTable/list row actions |
| Moduloversiktskort på Lager | Beholdes som arbeidsinnganger, men ikke som eneste navigasjon |
| Tilbakeknapp i fokusflyt | PageHero/breadcrumb, ikke ModuleNav |

Migreringsregel:

1. Klassifiser hvert eksisterende element som global route, lokal route,
   visningsfilter eller handling.
2. Flytt bare global/lokal route til navbarene.
3. Tabs og toolbar beholder sidefunksjonen; de skal ikke kopiere ModuleNav.
4. Når samme route finnes både som Lager-kort og lokal nav, er det akseptabelt:
   kortet anbefaler arbeid, navbaren gir stabil orientering.
5. En label/handling skal ikke finnes samtidig i global navbar, ModuleNav og
   PageToolbar.

### 21.8 Påvirkning på de fem implementeringscommitene

Antallet commits beholdes. Innholdet justeres:

1. **Tokens:** uendret.
2. **Grunnkomponenter:** uendret; Tabs beholdes som egen primitive.
3. **Layout og navigasjon:** utvides med `ModuleNav`,
   `ModuleNavMobile`, typed modulregistry og Lager-konfigurasjon. Global navbar
   reduseres til toppnivåmoduler.
4. **Lager-pilot:** bruker begge navigasjonsnivåer. Footer fjernes bare på
   piloten. Eksisterende kort beholdes.
5. **Pilotjustering:** tester særlig global/lokal aktiv state, mobilhierarki,
   duplikater og orientering.

Commit 3 blir større enn i første plan, men fortsatt avgrenset og reverserbar.
Hvis reviewstørrelsen blir for høy, kan committen internt deles i `3a global
navbar` og `3b module nav`, uten at leveransefasene eller rollbackstrategien
endres.

### 21.9 Reviderte navigasjonsakseptansekriterier

- Global navbar inneholder bare toppnivåmoduler og globale verktøy.
- Lokal navbar vises bare for moduler med varige underområder.
- Lager viser riktig aktiv global modul og riktig lokalt arbeidsområde.
- Dashboard har ingen tom lokal navbar.
- Tabs brukes bare til innholdsfiltrering eller visningsbytte.
- PageToolbar brukes bare til sidefiltre og handlinger.
- Mobilbrukeren kan identifisere både modul og arbeidsområde uten å åpne meny.
- Ingen lenke dupliseres på alle tre navigasjons-/kontrollnivåer.
- Dato/klokke, samlet adminmeny og Børre forblir globale.
- SnakeFooter fjernes gradvis som tidligere avtalt.
- Viper endres ikke utover å være synlig som global toppnivåmodul.
