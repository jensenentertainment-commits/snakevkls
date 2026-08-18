# Kartlegging av Børre og Arne i dagens Snake OS

## Sammendrag

Dagens Børre og Arne er to tekstassistenter bygget rundt samme React-chat og to separate API-ruter mot OpenAI Responses API.

- **Børre** har tilgang til begrensede, men reelle lagerdata. Han kan analysere og svare, men har ingen verktøy som kan utføre lagerarbeid eller endre data.
- **Arne** er en adminbeskyttet rådgiver som får statisk prosjektkunnskap og samme operative lagerkontekst som Børre. Han har ingen reell prosjekthukommelse, kodeinnsikt, koordinering eller tilgang til andre digitale ansatte.
- Ingen av dem har funksjonskall, verktøyregister, databasebasert samtalehistorikk eller observability utover enkelte generelle `console.error`-kall andre steder.
- Det finnes betydelig overlapp og eldre rester: Arne ligger delvis under `borre/`, Labs peker på en ikke-eksisterende `/borre/pro`, og flere Børre-kontekst- og briefimplementasjoner er duplisert eller ubrukt.

Kartleggingen var helt read-only. Ingen kode, konfigurasjon, prompts eller data ble endret under analysen. Repoet hadde på forhånd den usporede mappen `supabase/.temp/`; den ble ikke berørt.

---

## Enkel arkitekturskisse

```text
Bruker
  |
  +-- /borre ------------------------+
  |                                  |
  +-- flytende Børre på utvalgte sider
  |                                  |
  +-- /arne -- admin-kontroll -------+--> AskBorre.tsx
                                          |
                                          | POST: question, page,
                                          |       siste 8 meldinger
                                          |
                           +--------------+---------------+
                           |                              |
                    /api/borre/ask                 /api/arne/ask
                           |                              |
                    admin eller lager               bare admin
                           |                              |
                 Børre-systemprompt               Arne-systemprompt
                 statisk Snake-kunnskap            statisk Snake-kunnskap
                 dashboard/lagerdata               statisk utviklingskontekst
                 utvalgte produktdata              Børres lagerkontekst
                           |                              |
                           +---------- OpenAI ------------+
                                      gpt-5-mini
                                           |
                                       tekstsvar

Separat presentasjonslag:
lager-/produkt-/avvikssider
  -> deterministiske Snake Intelligence-hjelpere
  -> enkelte selvstendige OpenAI-genererte Børre-tekster
```

Det finnes ikke et agent- eller verktøylag mellom språkmodellen og Snake-funksjonene.

---

# 1. Børre

## 1.1 Primære filer

| Fil | Funksjon |
|---|---|
| `app/components/AskBorre.tsx` | Felles chatgrensesnitt for både Børre og Arne. |
| `app/borre/page.tsx` | Børres dedikerte side med chat og lagerobservasjoner. |
| `app/api/borre/ask/route.ts` | Autentisering, datainnhenting, promptbygging og OpenAI-kall. |
| `lib/intelligence/borre/chat-system.ts` | Børres hovedprompt, identitet, stil og ansvarsgrenser. |
| `lib/intelligence/borre/shared-context.ts` | En gjenbrukbar lagerkontekst, i praksis brukt av Arne – ikke av Børres chatrute. |
| `lib/dashboard.ts` | Beregner dashboard- og lagerstatistikk med Supabase service role. |
| `lib/intelligence/snake-intelligence.ts` | Deterministisk Snake Health og anbefalt handling. |
| `lib/intelligence/shared/snake-knowledge.ts` | Statisk felles kunnskap om Snake, roller, moduler og prioriteringer. |
| `lib/intelligence/shared/build-snake-knowledge.ts` | Gjør deler av den statiske kunnskapen om til prompttekst. |

## 1.2 Identitet og svarstil

Hovedidentiteten defineres i `lib/intelligence/borre/chat-system.ts`:

- lagerassistent og digital lagerkollega
- skal hjelpe brukerne å finne informasjon og forstå Snake
- skal være kort, praktisk og rolig
- omtaler seg selv i tredjeperson
- kan bruke dempet lagerhumor
- skal ikke diskutere arkitektur, systemdesign eller videreutvikling

Identiteten finnes også delvis duplisert i:

- `lib/intelligence/shared/snake-knowledge.ts`
- `lib/intelligence/borre/warehouse-assessment.ts`
- `lib/intelligence/borre/dashboard-brief.ts`
- `lib/intelligence/get-borre-dashboard-brief.ts`

Dette gir flere selvstendige definisjoner av samme personlighet uten én autoritativ promptkilde.

## 1.3 Data Børre kan lese

Børres chatrute henter:

- antall aktive og plasserte produkter
- antall quantity diff
- produkter uten lokasjon
- produkter uten SKU
- tomme lokasjoner
- lokasjoner uten sone
- Snake Health og nivå
- siste Shopify-sync med status, tidspunkt, sync-ID og metadata
- de første ti inventory-radene uten lokasjon
- produktnavn, SKU og antall for disse radene
- klientinnsendt sidebane

Dette bygges i `app/api/borre/ask/route.ts`, særlig linje 32–156.

`getDashboardStats()` bruker en Supabase-klient med service role, ikke brukerens RLS-sesjon, se `lib/dashboard.ts` og `lib/supabase/admin.ts`. API-ruten autentiserer først brukeren, men selve statistikklesingen omgår RLS.

Konteksten omfatter ikke:

- ordre eller plukk
- full produktliste
- detaljert lokasjonsinnhold
- brukerens profil utover tilgangskontrollen
- historiske lagertrender
- generelt innhold fra Dashboard eller Brief
- kodebase eller dokumentasjon

## 1.4 Verktøy og funksjoner

Børre har ingen modellverktøy eller funksjonskall.

OpenAI-kallet i `app/api/borre/ask/route.ts` sender bare meldinger til modellen. Det sendes ingen `tools`, ingen handlingsdefinisjoner og ingen dispatcher.

Børres praktiske funksjoner er derfor begrenset til:

- forklare innsendte data
- rangere oppgaver
- formulere råd
- svare på oppfølgingsspørsmål innenfor de siste meldingene

Lenker og anbefalte handlinger i Snake Intelligence er vanlig React-navigasjon, ikke handlinger utført av Børre.

## 1.5 Kan Børre endre data?

Nei.

Børres API-rute utfører bare `select`-spørringer. Det finnes ingen `insert`, `update`, `delete`, RPC eller kall til eksisterende lager-API-er.

Dette står i kontrast til hovedprompten, som sier at Børre skal hjelpe med å «rydde opp i lagerdata» og «løse praktiske oppgaver» i `lib/intelligence/borre/chat-system.ts` linje 7–10. Kodebasen gjør bare rådgivning mulig.

### Reelt ansvarsområde

Børres reelle ansvar er:

> En lagerorientert lese- og rådgivningsassistent som forklarer et fast sett med aggregerte lagerdata og kan anbefale hvilken oppryddingsoppgave brukeren bør starte med.

Han er ikke i dag en operativ digital lageransatt.

## 1.6 Sidekontekst og brukerrolle

Chatkomponenten sender:

```text
question
page = usePathname()
history = siste åtte lokale meldinger
```

Se `app/components/AskBorre.tsx` linje 85–94.

`page` er klientkontrollert og brukes bare som tekstlig modellkontekst. Den brukes ikke til å hente data som er spesifikke for siden.

Brukerrollen sendes ikke til modellen. Den håndheves på serveren gjennom:

- `requireRole(["admin", "lager"])` i Børre-ruten
- aktiv profil og gyldig rolle i `lib/auth/require-role.ts`

Dermed vet Børre ikke om han snakker med admin eller lager, selv om begge har tilgang.

## 1.7 Flater hvor Børre finnes

### Interaktiv chat

- `/borre`: full sidechat i `app/borre/page.tsx`
- flytende chat fra `app/layout.tsx`

Den flytende chatten vises på rutene definert i `app/components/AskBorre.tsx`:

- `/lager`
- `/products`
- `/locations`
- `/issues`
- `/location-count`
- `/activities`
- `/snakeboard`
- `/viper`

Det finnes også en ekstra `<AskBorre />` direkte på lagersiden, samtidig som root-layout allerede monterer den globalt. Dette kan gi dobbel chatinstans på `/lager`, se `app/lager/page.tsx`.

### Navigasjon og dashboard

- alltid synlig Børre-lenke i `app/components/SnakeNav.tsx`
- dashboardkort for admin og lager i `app/dashboard/page.tsx`
- Børre-navn brukes i tidsbaserte dashboardtekster

### Snake Intelligence og statiske Børre-flater

- `SnakeIntelligencePanel` på lagersiden
- `BorrePanel` på produkter, avvik og ryddemodus
- Børre-formulerte statustekster direkte i produkter, lokasjoner, avvik og lokasjonstelling

Mye av dette er deterministisk UI-tekst, ikke svar fra chatassistenten.

## 1.8 Samtaler og historikk

Historikken finnes bare i React-state:

- `useState<Message[]>([])` i `AskBorre.tsx`
- siste åtte meldinger sendes til API-et
- API-et validerer rolle og teksttype og sender dem videre til modellen

Konsekvenser:

- historikken forsvinner ved refresh, navigasjon eller lukking av komponenten
- ingen samtaler lagres i Supabase
- ingen samtale-ID eller brukerkobling
- ingen historikksøk
- ingen revisjonsspor
- ingen støtte for samtaler på tvers av enheter

## 1.9 Feil, logging og tilgangsstyring

### Feilhåndtering

Chatklienten viser generiske fallbacktekster ved nettverksfeil.

API-ruten mangler `try/catch` rundt:

- `req.json()`
- databaselesing
- OpenAI-kallet

OpenAI- eller databasefeil blir dermed ordinære ufangede 500-feil.

Databasesvarenes `error`-felt kontrolleres heller ikke i Børre-ruten. Feil kan derfor presenteres som tomme datasett.

### Logging

Børre-chatten logger ikke:

- forespørsler
- modellfeil
- responstid
- tokenbruk eller kostnad
- bruker
- side
- sikkerhetshendelser

`activity_log` leses for sync-status, men Børres samtaler skrives ikke dit.

### Tilgang

API-tilgangen er serverhåndhevet for aktive `admin`- og `lager`-profiler. RLS-policyene krever aktive roller i `supabase/migrations/20260720220651_phase_1_auth_rls.sql`.

`/borre` har ikke en egen rollekontroll i siden, men den generelle proxyen krever innlogget aktiv bruker. Den sensitive API-ruten utfører egen kontroll.

## 1.10 Koblinger

### Snake Intelligence og Snake Health

Sterk kobling:

- Snake Health beregnes deterministisk i `lib/intelligence/snake-intelligence.ts`
- samme tall sendes til Børres prompt
- Snake Intelligence-panelet presenteres som «Børres vurdering»

Snake Intelligence er i praksis en generell lagerregelmodul med Børre-merkevare, ikke en intern evne hos chatassistenten.

### Dashboard

Dashboardet har kort og Børre-tekst, men de to OpenAI-baserte dashboard-briefene ser ut til å være ubrukt:

- `lib/intelligence/borre/dashboard-brief.ts`
- `lib/intelligence/get-borre-dashboard-brief.ts`

De er nesten duplikater.

### Brief

`getBorreBrief()` brukes av Snake Intelligence-panelet, men er deterministisk og uten OpenAI.

### Aktivitetslogg

Børre leser siste Shopify-sync indirekte fra `activity_log`, men leser ikke den generelle aktivitetsstrømmen og skriver ingen egen aktivitet.

## 1.11 Særskilt teknisk funn i `BorrePanel`

`app/components/BorrePanel.tsx` utfører `getBorreWarehouseAssessment()` på modulnivå:

```text
const borreAssessment = await getBorreWarehouseAssessment();
```

Panelet bruker deretter alltid `borreAssessment.message`, ikke `message`-propen.

Det betyr at:

- innsendt `message` ignoreres
- alle `BorrePanel`-instansene viser samme genererte lagervurdering
- OpenAI-kallet er bundet til modulinnlasting/cacheadferd, ikke tydelig til hver render eller forespørsel
- teksten kan bli foreldet
- et presentasjonskomponent har skjult ekstern I/O

Dette er både uklar arkitektur og sannsynlig funksjonell feil.

---

# 2. Arne

## 2.1 Primære filer

| Fil | Funksjon |
|---|---|
| `app/arne/page.tsx` | Adminbeskyttet Arne-side. |
| `app/api/arne/ask/route.ts` | Adminbeskyttet prompt- og OpenAI-rute. |
| `lib/intelligence/arne/system.ts` | Aktiv Arne-systemprompt. |
| `app/components/AskBorre.tsx` | Gjenbrukt Børre-komponent med `variant="arne"`. |
| `lib/intelligence/borre/shared-context.ts` | Operativ lagerkontekst til Arne. |
| `lib/intelligence/borre/development-context.ts` | Hardkodet prosjektstatus, moduler, sprint og planer. |
| `lib/intelligence/shared/snake-knowledge.ts` | Felles statisk Arne-identitet og Snake-kunnskap. |

## 2.2 Eldre Børre Pro / Pro-system

Det finnes en eldre Arne-prompt under Børres mappe:

- `lib/intelligence/borre/pro-system.ts`

Den eksporterer også `getArneSystemPrompt()`, men den aktive API-ruten importerer den nyere filen fra `lib/intelligence/arne/system.ts`. `pro-system.ts` ser derfor ubrukt ut.

Labs viser Arne som aktiv, men peker til `/borre/pro`:

- `app/labs/page.tsx`

Det finnes ingen slik siderute. Den reelle siden er `/arne`. Dette er også dokumentert som eldre gjeld i `docs/phase-5-remove-spm.md`.

Arne har ingen egen synlig navlenke i `SnakeNav`.

## 2.3 Identitet og svarstil

Aktiv prompt definerer Arne som:

- Snake-ekspert
- rådgiver for admin
- kritisk kollega som skal utfordre admin
- rådgiver om arbeidsflyt, UI, databehov, moduler og roadmap
- ikke generell chatbot eller kodeassistent
- kort, direkte og norskspråklig

Se `lib/intelligence/arne/system.ts`.

Prompten gir Arne omfattende påstått systemkunnskap: «Du kjenner Snake ut og inn» og «Du kjenner prosjektet ut og inn». Den faktiske konteksten støtter ikke dette fullt ut.

## 2.4 Data Arne kan lese

Arne får tre kontekstblokker:

1. **Snake Knowledge**  
   Statisk identitet, retning, assistentroller, prinsipper og prioriteringer.

2. **Development Context**  
   Hardkodet status, modulliste, planlagte moduler, prinsipper, sprint og sannsynlig neste arbeid fra `lib/intelligence/borre/development-context.ts`.

3. **Operational Context**  
   Samme lagerstatistikk og produktutvalg som Børres delte kontekst fra `lib/intelligence/borre/shared-context.ts`.

Arne får ikke:

- repo- eller kodeinnhold
- dokumentasjon fra `docs/`
- Git-historikk
- issues eller backlog fra et eksternt system
- databasebaserte beslutninger
- tidligere Arne-samtaler
- faktisk roadmap utover hardkodede arrays
- generell aktivitetslogg utover siste Shopify-sync
- tilstand eller oppgaver hos andre digitale ansatte

## 2.5 Verktøy og skrivetilgang

Arne har ingen verktøy eller funksjonskall. Han kan bare returnere tekst.

Arne kan ikke:

- endre roadmap
- registrere beslutninger
- opprette oppgaver
- oppdatere konfigurasjon
- lese kode på forespørsel
- kontakte eller delegere til Børre
- koordinere andre digitale ansatte
- skrive aktivitetslogg

Dette samsvarer delvis med promptens avgrensning mot kode, men ikke med en rolle som faktisk leder for Digital Workforce.

## 2.6 Admin-tilgang

Admin-tilgangen håndheves i to lag:

- siden leser brukerens profil og krever `active && role === "admin"` i `app/arne/page.tsx`
- API-et krever `requireRole(["admin"])` i `app/api/arne/ask/route.ts`

Dette er riktig prinsipp: beskyttelsen ligger ikke bare i UI.

Labs bruker derimot klientbasert `RoleGate`, men den ødelagte lenken gjør at dette ikke er den reelle inngangen til Arne. Direkte `/arne` er fortsatt serverbeskyttet.

## 2.7 Samtaler og historikk

Arne bruker nøyaktig samme lokale historikkmodell som Børre:

- React-state
- maksimalt åtte tidligere meldinger
- ingen varig lagring
- ingen samtale-ID
- ingen prosjekthukommelse

Prompten instruerer Arne om å bruke «tidligere Snake-beslutninger» i `lib/intelligence/arne/system.ts`, men API-et tilfører ingen beslutningshistorikk. Et søk i kodebasen fant ingen annen beslutningskilde.

Arne kan derfor bare si «Dette har vi diskutert før» dersom diskusjonen ligger blant de siste åtte meldingene eller modellen feilaktig utleder det fra statisk kontekst.

## 2.8 Koblinger

### Dashboard

Ingen direkte Arne-integrasjon.

### Brief

Ingen Arne-brief eller administrativ morgen-/statusbrief.

### Snake Intelligence og Snake Health

Arne får hele Børres operative lagerkontekst. Det gjør at han kan kommentere lagerstatus, men koblingen er gjenbruk gjennom Børre-navngitte tjenester, ikke en generell Intelligence-tjeneste.

### Aktivitetslogg

Bare siste Shopify-sync inngår indirekte. Arne får ikke aktivitetsstrømmen som grunnlag for strategisk vurdering.

### Roadmap og tidligere beslutninger

Roadmap-lignende kunnskap er statisk TypeScript-innhold, ikke en levende kilde. `development-context.ts` sier blant annet at Arne fortsatt er en planlagt modul, selv om `/arne` og API-et allerede finnes. Dette illustrerer risikoen for foreldet hardkodet prosjektkunnskap.

## 2.9 Arnes reelle rolle

Arne er i dag:

> En adminbeskyttet, promptstyrt produkt- og systemrådgiver med statisk Snake-kunnskap og tilgang til et begrenset øyeblikksbilde av lagerdriften.

Han utfører strategisk rådgivning i tekst, men har begrenset faktisk systemkunnskap.

Han koordinerer ikke andre digitale ansatte. Det finnes ingen:

- arbeidsfordeling
- oppgavekø
- ansattregister
- handoff
- tilstandsmodell
- verktøydelegering
- resultatoppfølging

Rollen «leder for Digital Workforce» finnes derfor ikke i dagens kode.

---

# 3. Felles grunnmur

| Område | Delt? | Funn |
|---|---:|---|
| Chatkomponent | Ja | Begge bruker `AskBorre.tsx`; Arne er en variant med annet endepunkt og tekster. |
| API-lag | Delvis | To separate, svært like ruter; ingen felles handler. |
| OpenAI-klient | Duplisert | Begge oppretter egen klient og bruker `gpt-5-mini`. |
| Verktøyregister | Nei | Finnes ikke. |
| Promptbygging | Delvis | Felles Snake Knowledge, separate systemprompts og separate kontekstblokker. |
| Datatilgang | Delvis | Begge bruker dashboarddata; Arne bruker Børres delte kontekst. |
| Samtalelagring | Ja, men bare lokalt | Samme React-state og siste åtte meldinger. |
| Tilgangskontroll | Ja | Begge bruker `requireRole`; Arne har i tillegg sidekontroll. |
| Logging/observability | Nei | Ingen felles modelltelemetri eller samtalelogging. |
| Feilhåndtering | Delvis | Felles generisk klientfallback; ingen robust serversidehåndtering. |

## Gjenbrukbart

- `requireRole()` og den sentrale rollemodellen
- serverhåndhevet aktiv profil
- deterministisk Snake Health
- skillet mellom statisk Snake-kunnskap og operativ kontekst
- grunnleggende chatvisning
- filtrering av historikkroller
- felles `snake-knowledge.ts`, dersom innholdet får tydelig eierskap og oppdateringsrutine

## Hardkodet eller feilplassert

- Børre- og Arne-svartekster i `AskBorre`
- endepunktvalg som en boolsk variant
- ruter hvor flytende Børre vises
- modellnavn i begge API-rutene
- alle prompts som lange strengblokker
- utviklingsstatus og roadmap i TypeScript
- Arne-kontekst under `lib/intelligence/borre/`
- eldre `pro-system.ts`
- Labs-lenken `/borre/pro`
- separate og dupliserte dashboard-briefimplementasjoner

---

# 4. Dagens arkitektur

Arkitekturen består av fire løst koblede deler:

1. **Rollebaserte UI-flater**  
   Dedikert Børre-side, dedikert Arne-side og Børre-merkede paneler.

2. **En enkel klientchat**  
   Holder samtalen lokalt og sender sidebane og siste meldinger.

3. **To serverruter**  
   Utfører rolle-/profilkontroll, bygger kontekst og kaller OpenAI.

4. **Lagerintelligens**  
   Deterministiske regler og noen selvstendige OpenAI-genererte presentasjonstekster.

Dette er nærmere «to promptprofiler over samme chat» enn et Digital Workforce-system.

---

# 5. Styrker

- Serveren håndhever tilgang til begge chat-API-ene.
- Arne er eksplisitt admin-only både på side- og API-nivå.
- Børre og Arne har tydelig forskjellige språklige ansvarsgrenser.
- Snake Health beregnes i kode og overlates ikke til modellen.
- Modellen får et avgrenset datasett fremfor generell databaseadgang.
- Ingen av assistentene kan utilsiktet skrive data gjennom dagens chat.
- Historikk filtreres til `user` og `assistant` før den sendes videre.
- Felles Snake-kunnskap er allerede skilt ut i en egen modul.

---

# 6. Svakheter og teknisk gjeld

## Nødvendig opprydding

- Rett den brutte Labs-lenken mellom `/borre/pro` og `/arne`.
- Avklar og fjern eller migrer ubrukt `borre/pro-system.ts`.
- Konsolider duplikatene av dashboard brief.
- Flytt Arne-kontekst ut av `lib/intelligence/borre/`.
- Rydd `BorrePanel` slik at den ikke har skjult OpenAI-kall på modulnivå og ikke ignorerer `message`-propen.
- Fjern mulig dobbel Børre-chat på `/lager`.
- Legg til kontrollert serversidefeilhåndtering for JSON, database og OpenAI.
- Valider maksimal lengde på spørsmål og historikkinnhold.

## Nyttig forbedring

- Ett felles API-/runtime-lag for modellvalg, validering, feil og telemetri.
- En generell operativ konteksttjeneste i stedet for `getBorreContext`.
- Én autoritativ identitetsdefinisjon per digital ansatt.
- Tydelig skille mellom deterministisk Snake Intelligence og assistentens språkpresentasjon.
- Eksplisitt modellering av hvilken brukerrolle som snakker med assistenten.
- Bedre aktualitetskontroll for hardkodet prosjektstatus.

## Fremtidig mulighet

- Varig samtale- og beslutningsminne.
- Verktøy med eksplisitte lese- og skrivetillatelser.
- Koordinering og handoff mellom digitale ansatte.
- Briefs og arbeidskøer basert på samme rollemodell.
- Reell Digital Workforce-ledelse for Arne.

---

# 7. Uklare ansvarsgrenser

- Børre skal «løse praktiske oppgaver», men kan bare gi råd.
- Snake Intelligence-regler presenteres som Børres egne vurderinger selv om de er generell systemlogikk.
- Arne beskrives som prosjektkyndig, men kjenner bare statisk, ufullstendig kontekst.
- Arne får samme lagerdata som Børre uten tydelig begrunnelse for hvilke strategiske oppgaver som krever dem.
- `snake-knowledge.ts` definerer både produktmodell, tilgangsmodell, roadmap og assistentpersonlighet.
- Dashboard- og lagertekster bruker Børre-navnet uten å være del av Børres chat eller hukommelse.
- «Tidligere beslutninger» er et promptløfte uten tilhørende datakilde.
- Arne er fremstilt som en egen modul, men implementert som en variant av `AskBorre`.

---

# 8. Sikkerhets- og tilgangsrisikoer

## Høyest relevante risikoer

1. **Service role bak generelle statistikktjenester**  
   `getDashboardStats()` omgår RLS. Dagens seleksjoner er avgrensede, men en fremtidig utvidelse kan utilsiktet eksponere data til begge roller.

2. **Kontekst sendes som brukermelding**  
   Snake Knowledge og operativ kontekst legges i en `user`-melding, ikke som en kontrollert system-/utviklerkontekst. Produktnavn eller andre databaseverdier kan i prinsippet inneholde instruksjonslignende tekst.

3. **Klientstyrt side og historikk**  
   API-et stoler ikke på dem for tilgang, men begge inngår direkte i modellinput og kan manipuleres.

4. **Ingen størrelsesgrenser eller rate limiting**  
   En autorisert bruker kan sende svært lange spørsmål eller mange kall, med kostnads- og stabilitetsrisiko.

5. **Ingen modellrevisjonsspor**  
   Det er ikke mulig å ettergå hvem som spurte, hvilken kontekst som ble brukt eller hva modellen svarte.

6. **Manglende databasefeilkontroll**  
   Databaselesefeil kan bli behandlet som tomme data og gi misvisende råd.

## Positivt sikkerhetsfunn

Dagens manglende verktøy- og skrivetilgang begrenser konsekvensen av prompt injection: modellen kan gi feil tekst, men kan ikke direkte endre lageret.

---

# 9. Hva som kan beholdes

- rolle- og aktivstatuskontrollen
- serverbeskyttelsen av API-ruter
- det grunnleggende rolleskillet mellom lagerdrift og administrativ rådgivning
- deterministisk beregning av Snake Health
- avgrenset og eksplisitt operativ kontekst
- felles Snake-kunnskap som konsept
- chatkomponentens grunnstruktur
- prinsippet om at Børre ikke håndterer arkitektur og Arne ikke er generell kodeassistent

---

# 10. Hva som trolig bør ryddes eller skilles ut

## Nødvendig opprydding

- skill Arne fysisk fra Børres mapper og navn
- fjern Børre Pro-rester
- reparer rute- og navigasjonsmodellen
- konsolider Børre-prompts og brief-filer
- reparer `BorrePanel`
- etabler robust feilvalidering

## Nyttig forbedring

- skill generell Intelligence fra Børre-presentasjon
- skill operativ kontekst fra assistentidentitet
- skill produktkunnskap fra levende roadmap og prosjektstatus
- sentraliser OpenAI-konfigurasjon, logging og modellpolicy
- innfør klare kontrakter for hva hver rolle får lese

## Fremtidig mulighet

- et separat arbeids-/verktøylag for digitale ansatte
- eksplisitt beslutningsminne for Arne
- oppgave- og koordinasjonsmodell for Digital Workforce
- godkjenningsstyrte skrivehandlinger for Børre

---

# 11. Anbefalt rekkefølge for videre arbeid

1. **Nødvendig opprydding:** dokumenter dagens autoritative ruter, slett eller merk eldre Pro-implementasjon og reparer Labs-lenken.
2. **Nødvendig opprydding:** rett `BorrePanel`, dupliserte briefs og dobbeltmontering av chat.
3. **Nødvendig opprydding:** sentraliser validering, feilbehandling og modellkonfigurasjon uten å endre rollenes funksjon.
4. **Nyttig forbedring:** trekk ut en assistentuavhengig operativ kontekst og en separat Snake Intelligence-modul.
5. **Nyttig forbedring:** fastsett én autoritativ kilde for identitet, ansvar og tilgang per digital ansatt.
6. **Nyttig forbedring:** bestem hva som er statisk produktkunnskap, levende roadmap og varig beslutningshistorikk.
7. **Fremtidig mulighet:** definer verktøy og tillatelser først etter at det er dokumentert hvilke handlinger Børre faktisk skal utføre.
8. **Fremtidig mulighet:** modeller Arnes Digital Workforce-ansvar først når ansatte, oppgaver, handoff og godkjenningsgrenser er konkret definert.

## Endelig vurdering

Børre og Arne har allerede et nyttig språklig og tilgangsmessig skille, men implementasjonen støtter foreløpig bare rådgivende tekstroller.

- Børre er ikke ennå en operativ digital lageransatt.
- Arne er ikke ennå leder eller koordinator for Digital Workforce.
- Felles grunnmur er hovedsakelig UI, statisk kunnskap og tilgangskontroll.
- Agentfunksjoner, verktøy, varig hukommelse, koordinering og observability finnes ikke i dagens løsning.
