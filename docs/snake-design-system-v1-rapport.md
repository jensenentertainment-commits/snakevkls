# Snake Design System v1 — kartlegging og anbefaling

Dato: 24.07.2026  
Status: Analyse, ingen frontendkode endret  
Omfang: `app/**/*.tsx`, `app/**/*.ts`, `app/globals.css` og 19 skjermbilder fra adminbruker

## Sammendrag

Snake OS har allerede en tydelig visuell identitet: mørk petrol ramme, lys arbeidsflate, blå operasjonell primærfarge, gull som merkevare/aktiv markering og en konsekvent bruk av store, avrundede flater. Det som mangler er ikke et nytt visuelt uttrykk, men et felles språk og felles komponenter.

I dag ligger designsystemet hovedsakelig som kopierte Tailwind-oppskrifter i sider og komponenter:

- `#055a7d` forekommer 198 ganger i 29 filer.
- `#b58a14` forekommer 101 ganger i 31 filer.
- `#062f3b` forekommer 34 ganger, hvorav 26 frontendfiler hardkoder den.
- `globals.css` definerer 18 domenevariabler, men bare `--foreground` påvirker rendret UI direkte. Farge-, flate- og radiusvariablene brukes ikke av komponentene.
- Kodebasen bruker minst 54 distinkte hexverdier, i tillegg til Tailwind-paletten og opasitetsvarianter.
- Radiusfamilien er visuelt gjenkjennelig, men har parallelle verdier og syntakser: `rounded-xl`, `rounded-2xl`, `rounded-3xl`, 22, 24, 26, 28 og 32 px.
- To modalimplementasjoner er i praksis kopier, og kort-, status-, input- og knappemønstre gjentas mange steder uten en felles primitive.

Anbefalingen er å bevare uttrykket, etablere semantiske tokens og migrere først de delene med høy gjenbruk og lav funksjonell risiko. Start med skall, sideheader, toolbar, knapper, inputs, badges og flater. Ta deretter Lager, Produkter, Lokasjoner og Avvik som pilotsider. Viper P1–P3 bør stå urørt til systemet er validert på lagerflytene.

## Metode og avgrensning

Kartleggingen er statisk. Den teller forekomster i kildekoden og sammenholder dem med de innsendte skjermbildene. Dynamiske tilstander som ikke er vist eller kan nås uten data, er vurdert fra komponentkodens varianter.

Dette er ikke en tilgjengelighetsrevisjon eller funksjonell produktrevisjon, men kontrast, fokus, responsivitet og informasjonsprioritering er omtalt der de er tydelige designproblemer.

Ingen UI- eller applikasjonskode er endret.

## Dagens designsystem

### Visuell grunnmodell

De fleste operative sider følger denne modellen:

1. Mørk petrol applikasjonsbakgrunn.
2. Global toppnavigasjon med pilleformede valg.
3. En sentrert arbeidsflate med maks bredde rundt 1440 px.
4. Mørk/blå hero med sidetittel og eventuelt søk.
5. Mørk toolbar med filtre og handlinger.
6. Hvit eller lys grå innholdsflate.
7. Høyt avrundede kort, tabeller og paneler.
8. Flytende Børre-knapp nederst til høyre og Snake-footer nederst.

Dashboard og innlogging bruker en hel-mørk «glass»-variant. Etikettutskrift bryter modellen og bruker en egen, lys printflate uten normal app-shell.

### Typografi

`app/layout.tsx` tilfører Geist Sans og Geist Mono via CSS-variabler. `body` bruker Geist Sans med Inter, Arial, Helvetica og sans-serif som fallback.

Det finnes en gjenkjennelig typografisk struktur:

- Sidetitler: vanligvis 3xl–4xl, semibold, tett tracking.
- Korttitler: xl–2xl eller mindre semibold.
- Brødtekst: hovedsakelig `text-sm`, ofte `leading-6`.
- Eyebrows, tabellhoder og badges: 11–12 px, uppercase, semibold/bold og tracking fra 0.08 til 0.24 em.
- Metadata: neutral-400/500 eller white med 45–65 % opasitet.

Strukturen fungerer, men nivåene er ikke navngitt eller konsolidert. Eyebrow-komponenten alene finnes med flere størrelser, vekter, trackingverdier og farger.

## CSS-variabler i `globals.css`

### Faktisk bruk

| Variabel | Forekomster som `var(...)` | Vurdering |
|---|---:|---|
| `--foreground` | 2 | Brukes av `--color-foreground` og `body`; faktisk aktiv |
| `--background` | 1 | Mappes til Tailwind-tema, men sidene hardkoder bakgrunn; indirekte/lite utnyttet |
| `--color-background` | 0 | Definert i `@theme`, ingen eksplisitt bruk funnet |
| `--color-foreground` | 0 | Definert i `@theme`, ingen eksplisitt bruk funnet |
| `--vk-blue` | 0 | Ubrukt; verdien hardkodes 198 ganger |
| `--vk-blue-soft` | 0 | Ubrukt |
| `--vk-muted-blue` | 0 | Ubrukt og samme verdi som `--vk-blue-soft` |
| `--vk-blue-light` | 0 | Ubrukt |
| `--vk-gold` | 0 | Ubrukt |
| `--vk-gold-bright` | 0 | Ubrukt; verdien hardkodes 101 ganger |
| `--vk-surface` | 0 | Ubrukt |
| `--vk-surface-2` | 0 | Ubrukt |
| `--vk-surface-3` | 0 | Ubrukt |
| `--snake-bg` | 0 | Ubrukt; verdien hardkodes 34 ganger |
| `--snake-panel` | 0 | Ubrukt; verdien hardkodes 11 ganger |
| `--snake-hero` | 0 | Ubrukt; verdien hardkodes 9 ganger |
| `--snake-border` | 0 | Ubrukt |
| `--snake-card-radius` | 0 | Ubrukt |
| `--snake-panel-radius` | 0 | Ubrukt |
| `--snake-control-radius` | 0 | Ubrukt |

I tillegg brukes `--font-geist-sans` og `--font-geist-mono`, men de opprettes av Next-fontoppsettet og er ikke designtokens definert i `globals.css`.

Konklusjon: `globals.css` beskriver intensjonen til et designsystem, men komponentene er ikke koblet til det. Variablene kan derfor ikke brukes til å endre tema eller sikre konsistens.

## Fargeinventar

### Mest brukte hardkodede hexverdier

Tallene inkluderer `globals.css`; antall filer under «filer» gjelder frontendfiler uten `globals.css`.

| Verdi | Forekomster | Frontendfiler | Dagens rolle |
|---|---:|---:|---|
| `#055a7d` | 198 | 28 | Primærblå: knapper, lenker, ikonflater, fokus, valgt tilstand |
| `#b58a14` | 101 | 30 | Gull: merkevare, aktiv navigasjon, CTA, advarsel |
| `#a77e05` | 35 | 14 | Mørkere gull, ofte tekst/hover |
| `#062f3b` | 34 | 26 | Appbakgrunn og mørke paneler |
| `#e8eef0` | 11 | 10 | Lys panel-/arbeidsflate |
| `#14565b` | 10 | 3 | Positiv/mørk grønn-petrol status |
| `#05495b` | 9 | 8 | Hero- og hoverflate |
| `#8a6704` | 9 | 8 | Mørk warning/gulltekst |
| `#044b68` | 6 | 5 | Primærknapp hover |
| `#044c6a` | 6 | 6 | Alternativ primærknapp hover |
| `#fbf6e8` | 6 | 4 | Varm advarsel-/manglerflate |
| `#b45454` | 6 | 3 | Lokal rød statusfamilie |
| `#042834` | 5 | 3 | Dyp hero/nav-farge |
| `#d5dee2` | 4 | 1 | Lokal kortkant i Lager |
| `#a77e04` | 3 | 3 | Nesten lik `#a77e05`; definert som `--vk-gold` |
| `#9f3f3f` | 3 | 3 | Lokal mørk rød tekst |

Totalt finnes minst 54 distinkte hexverdier. Flere er én-gangsverdier for gradienter, labs, login og spesialtilstander.

### Gjentakende Tailwind-farger

De mest brukte ikke-arbitrary fargeklassene er:

| Klasse | Forekomster | Rolle |
|---|---:|---|
| `text-white` | 119 | Tekst på mørk flate |
| `bg-white` | 112 | Kort og innholdsflater |
| `text-neutral-500` | 104 | Sekundærtekst/labels |
| `text-neutral-950` | 103 | Primærtekst på lys flate |
| `border-neutral-200` | 82 | Standardkant på lyse flater |
| `bg-neutral-50` | 64 | Subtile felt og kort |
| `border-white/10` | 63 | Standardkant på mørke flater |
| `border-black/10` | 47 | Alternativ lysflatekant |
| `text-neutral-600` | 40 | Brødtekst |
| `text-neutral-700` | 36 | Sterkere sekundærtekst |
| `text-neutral-400` | 34 | Metadata/placeholder |
| `border-neutral-300` | 30 | Inputs og tydeligere kontroller |

Semantiske Tailwind-farger brukes parallelt med egne statusfarger:

- rød: `red-50/100/200/300/400/500/600/700`
- grønn/emerald: både `green-*` og `emerald-*`
- warning: både `amber-*` og egne gullverdier
- labs: `violet-*`
- enkelte cyan/sky-verdier i lagerkort

Dette gir minst tre overlappende statusfamilier: Tailwind semantic, Snake/VK hardkodet og enkeltkomponenters lokale palett.

### Fargeduplikater og nesten-duplikater

- `--vk-blue-soft` og `--vk-muted-blue` er identiske (`#4b6c93`).
- `#a77e04` og `#a77e05` brukes som om de er samme mørke gulltone.
- Primær hover finnes som `#044b68`, `#044c6a` og `#04495f`.
- Mørke flater bruker blant annet `#062f3b`, `#05495b`, `#04424c`, `#042834`, `#083844`, `#063a46`, `#063640` og `#0b4a5a` uten navngitt nivåsystem.
- Positiv status bruker både green, emerald og `#14565b`.
- Kritisk status bruker både Tailwind red og den dempede familien `#b45454`/`#9f3f3f`.

## Radius, spacing og shadow

### Radius

| Radiusklasse | Forekomster | Typisk bruk |
|---|---:|---|
| `rounded-2xl` | 178 | Inputs, knapper, små/mellomstore kort |
| `rounded-full` | 64 | Badges, nav, avatarer, ikonknapper |
| `rounded-xl` | 49 | Kompakte kontroller og filterknapper |
| `rounded-3xl` | 32 | Store kort/empty states |
| `rounded-[26px]` | 18 | Sideshell og større paneler |
| `rounded-[24px]` | 15 | Kort og indre paneler |
| `rounded-[28px]` | 11 | Sideshell, hero, modal |
| `sm:rounded-[32px]` | 9 | Responsivt sideshell |
| `rounded-[32px]` | 5 | Dashboard/login/hero |
| `rounded-t-[28px]` | 5 | Mobilmodal |
| `sm:rounded-[28px]` | 5 | Desktopmodal |
| `rounded-lg` | 5 | Små produktkontroller |
| `rounded-[22px]` | 1 | Produktprogresjon |

De eksisterende variablene på 18, 26 og 28 px treffer bare deler av faktisk bruk. 18 px brukes ikke eksplisitt; Tailwinds `rounded-2xl` tilsvarer 16 px. Resultatet er en familie som ser sammenhengende ut, men mangler faste roller.

### Spacing

Mest brukte verdier:

- horisontal padding: `px-4` 140, `px-5` 129, `px-3` 43, `px-6` 33
- vertikal padding: `py-3` 117, `py-5` 62, `py-4` 56, `py-2` 46
- avstand over: `mt-2` 77, `mt-1` 49, `mt-4` 49, `mt-3` 33
- gaps: `gap-2` 72, `gap-3` 42, `gap-4` 36
- sidecontainer: `mx-auto` 33; `max-w-[1440px]` går igjen på hovedsidene

Dette viser en god, implisitt 4-pikselsskala. Problemet er primært rollebruk, ikke selve skalaen: like komponenter velger ofte 16, 20 eller 24 px lokalt uten en dokumentert tetthetsvariant.

### Shadows

| Shadow | Forekomster |
|---|---:|
| `shadow-sm` | 59 |
| `shadow-2xl` | 37 |
| `shadow-black/30` | 20 |
| `shadow-lg` | 8 |
| `shadow-inner` | 7 |
| `shadow-white/5` | 7 |
| `shadow-xl` / `hover:shadow-xl` | 6 |
| øvrige navngitte og arbitrary shadows | minst 13 varianter |

Store sideshells bruker ofte `shadow-2xl shadow-black/30`, mens kort bruker `shadow-sm`. Dette er et godt utgangspunkt. Dashboard, login, nav, produktmarkering og hovertilstander tilfører flere lokale arbitrary shadows som bør reduseres til et lite elevation-sett.

## Komponentvarianter i dag

### Kort

Minst disse familiene finnes:

1. Mørkt glasskort: hvit 4–6 % bakgrunn, `border-white/10`, blur og mørk shadow.
2. Standard hvitt kort: `bg-white`, neutral/black 10 % kant, 24–26 px radius, `shadow-sm`.
3. Tonet arbeidskort: blå, rød, gull eller disabled bakgrunn og kant.
4. Modul-/navigasjonskort: ikonmedaljong, statusbadge, beskrivelse, divider og tekstlenke.
5. Kompakt horisontalt kort: ikon, tittel, beskrivelse og CTA.
6. Stat-/metadatakort: liten label og sterk verdi.
7. Liste-/eventkort: rad med ikon, badges, innhold og metadata.
8. Empty-state-kort: dashed border, sentrert ikon og tekst.
9. Sidepanel/assistant-kort: hvitt eller mørkt panel med forklaring og anbefaling.
10. Produktkort for mobil og detaljkort for produkt.

### Knapper

1. Primær blå fylt knapp.
2. Gull fylt knapp for «Ny», print, Børre og enkelte primærhandlinger.
3. Sekundær hvit/outlined knapp.
4. Mørk/transparent knapp på hero/toolbar.
5. Tekstlenke med eller uten pil.
6. Destruktiv rød outlined knapp.
7. Ikonknapp, både kvadratisk og rund.
8. Pilleknapp for nav og filter.
9. Disabled knapp via opacity eller eksplisitt grå flate.

Blå og gull bytter på å være primærhandling uten en stabil regel. På System er «Ny sone» gull mens «Ny bruker» er blå. På Lokasjoner er «Ny lokasjon» gull, men modalens «Opprett» er blå.

### Badges og statuser

1. Filterbadge med antall.
2. Statuspill for plassert/advarsel/mangler.
3. Alvorlighet: kritisk, sjekk, info.
4. Aktiv/inaktiv.
5. Modultilstand: aktiv, neste steg, snart.
6. Sonebadge med lokalt fargevalg.
7. Aktivitetsbadge med eventtype.
8. Systempulse/statusdot.
9. Antallsbadge uten semantisk farge.

`app/components/products/Status.tsx` har en lokal `ok | warning | danger`-modell. Zoner og produktdetalj definerer egne tilsvarende stilkart. Aktiviteter og avvik bruker igjen andre regler.

### Tabeller og lister

1. Standard administrasjonstabell med uppercase 11 px header.
2. Produktmatrise med bilder, faste kolonnebredder, interaktive celler og 104 px rader.
3. Lokasjonstabell med kompakte teksthandlinger.
4. Sonetabell.
5. Hendelseslogg som visuelt ligner en tabell, men er kort/rader gruppert per dag.
6. Avviksliste som vertikale arbeidskort/rader.
7. Brukeradministrasjon som skjemarader i kort, ikke tabell.
8. Viper kø-/ordrelista som arbeidskort.

Tabellmønstrene deler overflate og typografi, men ikke en felles tabellprimitive eller tetthetsmodell.

### Inputs

1. Lys standardinput på hvit/neutral flate.
2. Hero-søk, stort og lyst på mørk flate.
3. Mørk textarea/input i Børre.
4. Native select.
5. Egendefinert `SnakeDropdown`, lys og mørk variant.
6. Checkbox og checkbox-kort.
7. Inline-input i produkt- og brukeradministrasjon.
8. Søkefelt med ikon.

Fokus kan være gull eller blått. Border kan være neutral-200, neutral-300, black/10 eller white/20. Høyder varierer mellom eksplisitt 32/40 px og paddingbaserte felt rundt 44–56 px.

### Paneler og sidekomposisjon

1. Standard sideshell: avrundet lys container med hero, toolbar og body.
2. Ren mørk glassflate: Dashboard, Børre, Arne og Labs.
3. Fokusert arbeidsflyt: Ryddemodus og telling med stor hero og tospaltet arbeidsområde.
4. Modal overlay: bunnark på mobil, sentrert dialog på desktop.
5. Print-/etikettside: egen lys canvas uten vanlig shell.
6. Chatpanel: flytende drawer eller inline panel.

## Duplikater

### Direkte eller nær direkte duplikater

- `CreateLocationModal.tsx` og `ZoneModal.tsx` deler overlay, modalramme, header, feltstil, checkbox-kort, footer og knapper nesten linje for linje.
- Sideshellen `min-h-screen bg-[#062f3b]` + `max-w-[1440px]` + `SnakeNav` + avrundet content + `SnakeFooter` gjentas i store deler av appen.
- Sidecontaineren med `rounded-[26px] ... sm:rounded-[32px]` finnes på Produkter, Avvik, Aktiviteter, Innstillinger, Viper og produktdetalj.
- Primærknappen med `rounded-2xl bg-[#055a7d] ... hover:bg[...]` kopieres på tvers av sider og komponenter med tre hoverfarger.
- Standardinput med `rounded-2xl ... px-4 py-3 ... focus:border-[#055a7d]` gjentas i modaler, innstillinger, konto, Snakeboard og arbeidsflyter.
- Filtertabs på Produkter, Avvik, Aktivitet, Lokasjoner, Soner og System følger samme idé, men implementeres lokalt.
- Standard tabellcontainer med hvit bakgrunn, neutral-200 border, stor radius og uppercase header gjentas.
- Statuspill har flere lokale implementasjoner.
- Eyebrow-labels gjentas med 0.12, 0.14, 0.16, 0.18, 0.20, 0.22 og 0.24 em tracking.

### Konsekvens

Små endringer krever redigering i mange filer og vil fortsette å skape drift. Likheten er stor nok til å gi forventning om konsistens, men liten nok til at avvikene blir synlige.

## Inkonsistens mellom sider

### Shell og bakgrunn

- Standardappens sider har mørk ramme og lys arbeidsflate, mens Dashboard og Børre er hel-mørke.
- Etikettsiden er helt lys og mister nav, footer og visuell sammenheng. Dette kan være riktig i printmodus, men skjermmodus bør fortsatt ha en tydelig appkontekst.
- Changelog bruker `#003b46`, mens resten primært bruker `#062f3b`.
- Flere skjermbilder viser en tynn hvit stripe øverst, som tyder på at dokument-/layoutbakgrunn eller scrollområdet ikke alltid dekkes av app-shell.

### Hero og sideheader

- Noen sider bruker felles `SnakeHero`; andre har lokalt kodet hero med `#05495b`.
- Hero-radius varierer med sideshellens 26, 28 og 32 px.
- Tilbakeknapper finnes både inne i hero, over innhold og som ren tekst på etikettflaten.
- Søket er noen ganger i hero, noen ganger i venstre arbeidskort og noen ganger ikke koblet til sidens tittelområde.

### Navigasjon og responsivitet

- Desktopnavigasjonen er visuelt sterk, men svært bred. Et skjermbilde av Viper viser høyre handlinger delvis avkuttet.
- Nav er skjult under `md`, men det finnes ikke en tilsvarende komplett mobilnavigasjon i den samme komponenten.
- Kombinasjonen av logo, ni hovedvalg, innstillinger, Labs, Børre og profil gir liten buffer for adminrollen, oversettelser og smal desktop.

### Handlinger

- Gull betyr både aktiv navigasjon, merkevare, warning og primær CTA.
- Blå betyr både primær CTA, lenke, fokus og informasjon.
- Teksthandlinger har varierende underline-regler.
- Noen rader har alle handlinger synlige som tekst, mens andre bruker knapper eller kortlenke.
- Disabled uttrykk varierer mellom opacity, grayscale og egne lyse flater.

### Status

- «Aktiv» kan være green, emerald eller petrol.
- «Kritisk» kan bruke sterk Tailwind-rød eller dempet egen rød.
- Warning og «mangler» bruker både amber og gull.
- Sonefarger ser semantiske ut, men er i praksis kategorifarger. De bør skilles visuelt og i tokens fra status.
- Flere statusindikatorer bruker farge som viktigste skille; ikon og tekst finnes ikke konsekvent.

### Tetthet og skannbarhet

- Produktlisten er svært bred og informasjonsrik, mens Avvik bruker romslige vertikale rader. De representerer beslektede lagerproblemer, men har ulik arbeidsdensitet.
- Systemets brukeradministrasjon blir et skjemakort per bruker, mens soner er tabell. Det gjør siden lang og vanskeligere å sammenligne.
- Ryddemodus og Telling har gode fokuserte arbeidsflater, men deres kort- og inputstil avviker fra CRUD-sidene.
- Børres observasjonspanel viser rå JSON i brukergrensesnittet. Det er primært et innholdspresentasjonsproblem, men bryter også tydelig med systemets øvrige lesbarhet.

### Modal

- Modalene er konsistente med hverandre i kode, men skjermbildet viser en lys blå disabled «Opprett»-knapp som ikke matcher øvrige disabled-mønstre.
- Bakgrunnsblur er kraftig og kan redusere orientering mer enn nødvendig.
- Det mangler synlig lukkeknapp; avbryt finnes i footer.

## Det som fungerer godt og bør beholdes

1. **Den overordnede identiteten.** Petrol, blått og gull gir Snake OS et tydelig, eget uttrykk.
2. **Mørk ramme + lys arbeidsflate.** Operative data blir lesbare, samtidig som produktet beholder merkevaren.
3. **Informasjonshierarkiet i hero.** Eyebrow, tydelig sidetittel, kort forklaring og søk er lett å forstå.
4. **Arbeidsflytretningen i Lager.** Modulene Varesøk, Lokasjoner, Ryddemodus og Avvik er godt differensiert med ikon, status og neste handling.
5. **Ryddemodus.** Én vare om gangen, synlig progresjon og sidepanel med Børre gir god fokus.
6. **Telling.** Venstre valgpanel og stor arbeidsflate gir en tydelig sekvens og god empty state.
7. **Produktlisten som operasjonelt verktøy.** Den prioriterer produkt, beholdning, sone og lokasjon på samme rad og har tydelige mangler.
8. **Aktivitetsloggen.** Dagsgrupper, eventbadges, tittel, beskrivelse og actor/tid gir god skannbarhet.
9. **Konsekvent bruk av ikon + tekst.** De fleste viktige moduler og handlinger kan identifiseres raskt.
10. **Avrundingsspråket.** Store myke flater er en tydelig del av Snake-identiteten; det bør strammes inn, ikke fjernes.
11. **Børre som vedvarende inngang.** Flytende plassering gjør assistenten tilgjengelig uten å dominere arbeidsflaten.
12. **Maksbredde og sentrering.** 1440 px gir et ryddig desktopoppsett for de fleste CRUD-sider.

## Hardkodede verdier som bør erstattes

### Prioritet 1: globale farger

- `#062f3b` → `surface.app`
- `#05495b` og gradientnivåer → `surface.hero` / hero-gradient
- `#e8eef0` → `surface.workspace`
- `#055a7d` → rollebaserte tokens som `action.primary`, `text.link`, `focus.brand`
- `#b58a14` → splittes i `brand.gold` og eventuelt `action.accent`
- `#a77e04`/`#a77e05` → én `text.warning` eller `brand.gold-strong`
- `border-white/10`, `border-black/10`, `border-neutral-200` → `border.on-dark`, `border.subtle`, `border.control`

### Prioritet 2: tilstander

- green/emerald/`#14565b` → ett success-sett
- amber/gull → skill warning fra brand/aktiv navigasjon
- Tailwind red/`#b45454`/`#9f3f3f` → ett danger-sett med surface, border, text og icon
- violet → behold som eksplisitt Labs-kategori, ikke generell info
- sonefarger → egen kategoripalett, separat fra status

### Prioritet 3: geometri og elevation

- 22/24/26/28/32 px → navngitte radiusroller
- arbitrary shadows → fire elevationnivåer
- gjentatt `max-w-[1440px]`, page padding og shell-radius → `AppShell`
- gjentatte 32/40/44/48/56 px kontrollhøyder → tre kontrollstørrelser

## Forslag til Snake Design System v1

### Prinsipper

1. **Operasjon først.** Designet skal gjøre neste riktige lagerhandling tydelig.
2. **Petrol er miljø, blå er handling, gull er identitet.** Warning får en egen amberfamilie.
3. **Status skal aldri være bare farge.** Bruk label og ved behov ikon.
4. **Samme rolle, samme komponent.** Lokale varianter skal uttrykkes som props, ikke kopiert className.
5. **Tetthet er en eksplisitt variant.** CRUD-tabeller kan være compact; arbeidsflyter comfortable.
6. **Adminfunksjoner skal bygge på samme primitive som lagerrollen.**
7. **Print er et eget medium, ikke et eget visuelt univers på skjerm.**

### Fargetokens

Foreslått semantisk modell; endelige kontrastverdier må verifiseres før implementering:

```text
surface.app
surface.app-elevated
surface.hero
surface.workspace
surface.card
surface.subtle
surface.overlay

text.on-dark
text.on-dark-muted
text.primary
text.secondary
text.muted
text.link
text.disabled

border.on-dark
border.subtle
border.control
border.strong
border.focus

action.primary.{default,hover,pressed,disabled}
action.secondary.{default,hover,pressed,disabled}
action.accent.{default,hover,pressed,disabled}
action.danger.{default,hover,pressed,disabled}

status.success.{surface,border,text,icon}
status.warning.{surface,border,text,icon}
status.danger.{surface,border,text,icon}
status.info.{surface,border,text,icon}
status.neutral.{surface,border,text,icon}

brand.gold
brand.gold-strong
category.labs
category.zone.1…n
```

V1 bør støtte både lys arbeidsflate og mørk appflate gjennom semantiske roller, ikke en generell «dark mode».

### Radius

Anbefalt rollemodell:

| Token | Forslag | Bruk |
|---|---:|---|
| `radius.control` | 12 px | Select, små knapper, kompakte inputs |
| `radius.action` | 16 px | Standardknapper og inputs |
| `radius.card` | 24 px | Kort og indre paneler |
| `radius.panel` | 28 px | Modal og større panel |
| `radius.shell` | 32 px | Hovedarbeidsflate |
| `radius.pill` | 9999 px | Nav, badges, avatar |

26 px kan fases ut til fordel for 24 eller 28. `rounded-3xl` og 24 px blir dermed samme rolle, ikke parallelle uttrykk.

### Spacing

Behold Tailwinds 4 px-baserte skala, men dokumenter komponentroller:

- control-x: 12/16/20 px
- control-y: 8/12/16 px
- card: 20/24 px
- panel: 24/32 px
- section-gap: 24/32/40 px
- page-gutter: 16 px mobil, 24 px tablet, 32 px desktop
- shell-max: 1440 px

### Elevation

| Token | Rolle |
|---|---|
| `elevation.none` | Tabellrader og flate seksjoner |
| `elevation.card` | Standardkort, omtrent dagens `shadow-sm` |
| `elevation.panel` | Dropdown, sticky handlingsfelt, omtrent `shadow-lg` |
| `elevation.overlay` | Modal/drawer, omtrent dagens `shadow-2xl shadow-black/30` |

Glasskortets skygge kan være en egen `elevation.glass`, men bare for dashboard/login og ikke som generell kortvariant.

### Typografi

Etabler navngitte tekststiler:

- `display.page`
- `heading.section`
- `heading.card`
- `body.default`
- `body.small`
- `label.eyebrow`
- `label.control`
- `label.table`
- `meta.default`

Samle eyebrow til 11 px, semibold, uppercase og én trackingverdi (foreslått 0.16 em). Bruk font-black bare når det er et bevisst merkevareuttrykk.

### Komponenter i v1

#### Fundament

- `AppShell`
- `AppHeader` / responsiv `MainNav`
- `PageFrame`
- `PageHero`
- `PageToolbar`
- `PageFooter`
- `Surface`
- `Stack`, `Inline` og eventuelt enkel `Grid`

#### Handling og input

- `Button`: primary, secondary, accent, danger, ghost; sm/md/lg; icon-only
- `IconButton`
- `TextLink`
- `TextField`
- `SearchField`
- `Textarea`
- `Select` basert på én implementasjon
- `Checkbox`
- `CheckboxCard`
- `FormField` med label, hint og error

#### Data og status

- `Badge`: neutral, info, success, warning, danger, category
- `StatusBadge`: obligatorisk tekst, valgfritt ikon
- `CountBadge`
- `Tabs` / `FilterTabs`
- `DataTable`: comfortable/compact
- `DataList`
- `EmptyState`
- `Progress`
- `Stat`

#### Komposisjon

- `Card`: standard, subtle, interactive, selected, disabled
- `ModuleCard`
- `InfoPanel`
- `Alert`
- `Modal`
- `Drawer`
- `ActionBar`

Det bør ikke opprettes én komponent per nåværende visuell variant. Start med primitive roller og komponer de mer produktspesifikke komponentene.

### Tilstandskontrakt

Alle interaktive komponenter skal ha dokumentert:

- default
- hover
- active/pressed
- focus-visible
- selected/current
- disabled
- loading
- error, der relevant

I dagens kode er hover og disabled relativt godt dekket, men `focus-visible`, loading og selected er ikke like systematiske.

## Anbefalt migreringsrekkefølge

### Fase 0 — visuell baseline

1. Lag referansebilder av admin- og lagerrolle på representative viewports.
2. Definer kontrastkrav og hvilke visuelle avvik som er tilsiktet.
3. Frys Viper P1–P3 visuelt og funksjonelt som avtalt.

### Fase 1 — tokens uten redesign

1. Innfør semantiske farge-, radius-, spacing- og elevationtokens.
2. Map dagens verdier 1:1 der det er mulig.
3. Skill brand-gull fra warning.
4. Samle success, warning, danger, info og neutral.
5. Koble Tailwind-temaet til tokens.

Målet er minimal visuell endring, men én sannhetskilde.

### Fase 2 — primitive komponenter

1. Button og IconButton.
2. Badge, StatusBadge og CountBadge.
3. FormField, TextField, SearchField, Select og Checkbox.
4. Surface/Card, EmptyState og Progress.
5. Modal; slå sammen CreateLocationModal- og ZoneModal-skallet.

### Fase 3 — app-shell

1. AppShell, sidegutter og maks bredde.
2. PageHero og PageToolbar.
3. Footer.
4. Responsiv nav og admin-overflow.
5. Børre-launcher og drawer.

Dette fjerner den største kilden til sidevis drift.

### Fase 4 — dataflater

1. FilterTabs.
2. DataTable og DataList.
3. Standard handlinger per rad.
4. Tetthetsvarianter.
5. Loading, empty og error.

### Fase 5 — pilotsider

Migrer Lager, Produkter, Lokasjoner og Avvik og gjennomfør visuell regresjon og lagerbrukertest.

### Fase 6 — øvrige operative sider

Telling, Ryddemodus, Aktivitet, Snakeboard, produktdetalj og lokasjonsdetalj.

### Fase 7 — admin og spesialsider

System/Innstillinger, konto, changelog, Labs, Arne, Børre og etiketter/print.

### Fase 8 — Viper

Når v1 er stabil og Viper tas av pause: migrer kun presentasjonslaget, med egne flytregresjoner for ordre, plukk og unntak.

## Hvilke sider bør tas først

### 1. Lager

Hvorfor:

- er den beste visuelle representasjonen av ønsket Snake-identitet
- viser mange kortvarianter, statuser, ikonflater og handlinger
- er inngangen for lagerrollen
- kan bli referansesiden for v1

Behold særlig den todelte hero/arbeidsflate-modellen og modulprioriteringen.

### 2. Produkter / Varesøk

Hvorfor:

- høy operativ verdi og høy brukstetthet
- flest kontrolltyper på én side: hero-søk, tabs, dropdowns, progresjon, tabell, inline select, badges og batchbar
- avdekker raskt om token- og komponentmodellen tåler ekte datatetthet
- `#055a7d`, gull og lokale statusfarger er tungt representert

### 3. Lokasjoner

Hvorfor:

- sentral i den kommende lagerstrukturen
- dekker tabell, filtre, select, primærhandling, modal og status
- gir mulighet til å slå sammen modalprimitive tidlig
- har lavere datakompleksitet enn Produkter og egner seg godt til å verifisere CRUD-mønsteret

### 4. Avvik

Hvorfor:

- tvinger frem en robust statusmodell
- deler søk, tabs og sideshell med Produkter
- er handlingsnær for lagerrollen
- vil avklare forskjellen mellom danger, warning og brand-gull

### 5. Telling og Ryddemodus

Hvorfor:

- er gode fokuserte arbeidsflyter som bør harmoniseres etter at primitive er stabile
- de må beholde lav kognitiv belastning og bør ikke presses inn i et tett CRUD-uttrykk

### Sider som bør vente

- **Viper:** satt på pause; høy funksjonell risiko og egen flyt.
- **System/Innstillinger:** mange adminvarianter, men mindre representativt for lagerrollen.
- **Børre/Arne/Labs:** spesialflater som trenger basetokens, men ikke bør definere dem.
- **Etiketter:** printkrav må behandles separat etter at skjermshell og kontroller er stabile.
- **Dashboard:** visuelt sterkt, men glassvarianten er ikke representativ for operative datasider.

## Foreslåtte beslutninger før implementering

1. Skal gull være kun brand/aktiv navigasjon, eller også primær handling?
2. Skal warning bruke en egen amberpalett, tydelig adskilt fra gull?
3. Skal hovedshell standardiseres til 32 px og kort til 24 px?
4. Skal standard desktopbredde fortsatt være 1440 px, med en bredere variant for produktmatrisen?
5. Skal DataTable støtte `compact` og `comfortable` fra start?
6. Skal etikettvisning ha app-shell på skjerm og kun fjerne det i `@media print`?
7. Hvilke sonefarger er nødvendige, og hvordan skal de skilles fra statusfarger?

## Akseptansekriterier for v1

- Ingen nye hardkodede merkevare- eller statusfarger i sidekomponenter.
- Alle primærknapper, inputs, badges og modaler bruker felles primitive.
- Én dokumentert regel for blå, gull, warning, success og danger.
- Maks seks radiusroller og fire elevationnivåer.
- Felles shell, hero og toolbar på operative sider.
- Full tastaturfokus med `focus-visible`.
- Status kommuniseres med tekst og eventuelt ikon, ikke bare farge.
- Adminnav fungerer uten avkutting på støttede desktopbredder.
- Printside er eksplisitt testet både på skjerm og utskrift.
- Visuell regresjon dekker admin- og lagerrolle på mobil, smal desktop og bred desktop.

## Konklusjon

Snake OS trenger en konsolidering, ikke en visuell omstart. Den eksisterende identiteten og flere arbeidsflyter er allerede gode. Snake Design System v1 bør først gjøre dagens beste mønstre eksplisitte, semantiske og gjenbrukbare. Den største gevinsten kommer fra å skille brand fra status, samle de mange lokale overflate- og kontrolloppskriftene og bruke Lager, Produkter, Lokasjoner og Avvik som referanse for resten av systemet.
