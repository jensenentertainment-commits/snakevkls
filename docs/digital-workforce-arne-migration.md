# Digital Workforce: Arne-ekvivalensmigrering

Dato: 18. august 2026

## Omfang

Eksisterende Arne er migrert til Minimal Digital Workforce Foundation uten å
endre rolle, systemprompt, modell, datakontekst, meldingsrekkefølge, UI,
forslag, autorisasjon, svarformat eller brukerrettede feilmeldinger.

Migreringen innfører ikke koordinatorrolle, routing, handoff, kommunikasjon
mellom ansatte, proaktive funn, tools, skrivehandlinger, minne, agent-loop eller
nye digitale ansatte.

## Foundation-kontrakt

Arne er registrert som:

- Employee: `arne`
- Capability: `snake.assess_development`
- Effekt: `read`
- Provider: `arne.advisory_context`
- Modell: eksisterende `gpt-5-mini`
- Prompt: eksisterende `getArneSystemPrompt`

Provideren leverer én strukturert kontekst med separate felt for Snake
Knowledge, development-context, operational-context og aktuell side. Det er én
provider og én capability per run. Development- og operational-context er
fortsatt de eksisterende funksjonene og er ikke ryddet eller normalisert.

## Policy

| Menneskelig rolle | Digital ansatt | Capability | Resultat |
| --- | --- | --- | --- |
| `admin` | `arne` | `snake.assess_development` | tillatt |
| `lager` | `arne` | `snake.assess_development` | avvist |
| alle | `arne` | ikke-deklarert capability | avvist |
| alle | ukjent ansatt | alle | avvist |

`POST /api/arne/ask` beholder `requireRole(["admin"])`. Foundation-policyen er
en ekstra server-side grense, og provider/modell kan ikke nås før den har gitt
eksplisitt tillatelse.

## Request-flow

1. Ruten autentiserer og krever aktiv admin.
2. Eksisterende `validateChatInput` validerer spørsmål, side og historikk.
3. Runtime autoriserer admin × Arne × `snake.assess_development`.
4. `arne.advisory_context` henter dagens tre kontekstblokker.
5. Arnes formatter beholder dagens overskrifter, JSON-format og rekkefølge.
6. Historikk og nytt spørsmål legges til i samme rekkefølge som før.
7. Eksisterende `gpt-5-mini` kalles nøyaktig én gang.
8. Ruten returnerer uendret `{ "answer": string }`; run-ID ligger bare i
   `x-workforce-run-id`.

## Automatisert verifisering

Karakterisering og ekvivalenstester dekker:

- admin-only endpoint og side
- eksisterende inputformat og grenser
- systemprompt, modell og fallbacktekst
- eksakt kontekstblokk- og meldingsrekkefølge
- uendret statisk development-context
- uendret operational-context og eksisterende Supabase-reads
- eksisterende Arne-forslag og lokal historikkgrense
- ingen tools eller writes
- admin tillatt, lager avvist fail-closed
- én provider før ett modellkall
- minimal run-metadata uten prompt, spørsmål, kontekst eller svar
- fortsatt Børre-regresjon

## Kontrollert test med ekte Arne-kontekst

Tre representative spørsmål ble kjørt mot eksisterende `gpt-5-mini` med
nøyaktig dagens karakteriserte kontekst. Testen var særskilt godkjent for siste
aktivitets aktørnavn/e-post, aggregerte lagerdata, siste Shopify-sync og inntil
ti produkt-/SKU-rader. Ingen datakilder ble lagt til.

| Spørsmålstype | Resultat | Modelltid |
| --- | --- | ---: |
| Nåværende utviklingsprioritet | Fullført; prioriterte lagerdatakvalitet og ferdigstilling av Børre | 13 100 ms |
| Varige svakheter | Fullført; pekte på dataintegritet, arbeidsflyt og driftssynlighet | 15 732 ms |
| Roadmap og hva som bør vente | Fullført; anbefalte å stabilisere lagergrunnlaget før flere moduler | 14 513 ms |

Tre unike run-ID-er ble produsert. Kontrolltelleren viste tre forventede og tre
faktiske modellkall. Alle runs fikk `completed`.

Run-metadata inneholdt bare run-ID, employee, capability, teknisk testaktør og
rolle, tidspunkt, resultat, deklarerte datakilder, modell og varighet. Prompt,
spørsmål, samtalehistorikk, development-context, operativ kontekst,
aktørnavn/e-post, produktdata og modellrespons ble ikke lagret som
run-metadata. Runs ble ikke databasepersistert.

Testen kjørte runtime direkte med read-only spørringer som gjenskapte dagens
provider. Den var derfor ikke en autentisert browser-til-database-test.
Route-, auth-, formatter- og UI-kontraktene er dekket automatisert. Det finnes
ingen gammel Arne-latencybaseline, og konteksten var forhåndslastet i harnessen;
tidene over er derfor bare modellventetid og kan ikke brukes som før/etter-mål.

## Eksplisitt kontekstgjeld

Følgende beholdes kun for ekvivalens og skal vurderes separat etter migreringen:

- `stats.latestActivity` serialiserer aktørnavn og aktør-e-post til Arne selv om
  de ikke er nødvendige for de fleste utviklingsvurderinger.
- `stats` inneholder rå dashboardstruktur samtidig som de samme tallene gjentas
  i normalisert `warehouse` og `shopifySync`.
- Shopify-sync finnes både inne i `stats` og i et eget normalisert felt.
- Operational-context gir detaljert produkt-/SKU-kontekst til alle spørsmål,
  selv når admin spør om retning eller roadmap.
- Development-context er statisk og inneholder foreldet sprint-, modul- og
  roadmapinformasjon, blant annet at Arne fortsatt er planlagt.
- Prompten omtaler tidligere beslutninger, men det finnes ingen beslutningskilde
  utover lokal samtalehistorikk og statisk kontekst.

Godkjenningen av den manuelle testen er ikke en beslutning om at aktørnavn eller
e-post skal inngå i Arnes permanente fremtidige kontekst.

## Eksplisitt adferdsgjeld observert i testen

Svarene var overordnet konsistente med dagens Arne, men modellen:

- foreslo enkelte konkrete UI-handlinger og tekniske tiltak som gikk lenger enn
  promptens produkt-/systemnivå
- foreslo en utviklingstid på én til to uker, selv om prompten forbyr estimater
- foreslo prioritering etter omsetning uten at omsetningsdata var tilgjengelig
- fant på konkrete go/no-go-terskler for Snake Health og datakvalitet

Dette er eksisterende modell-/promptadferd. Det er dokumentert, men ikke endret
som del av ekvivalensmigreringen.

## Status etter migreringen

Børre og Arne bruker samme minimale read-only execution-kontrakt, men har hver
sin eksplisitte EmployeeDefinition, capability, provider og formatter. Runtime
inneholder bare de to godkjente kombinasjonene og gjør ingen semantisk routing.
Arne er fortsatt rådgiver, ikke koordinator.
