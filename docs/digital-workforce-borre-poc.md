# Digital Workforce: Børre proof-of-concept

Dato: 18. august 2026

## Omfang

Proof-of-conceptet flytter bare `POST /api/borre/ask` fra en inline
implementasjon til Minimal Digital Workforce Foundation. Endepunkt, menneskelige
roller, validering, modell, systemprompt, kontekst, meldingsrekkefølge,
JSON-respons, feilmeldinger og UI-kontrakt er beholdt.

Det er ikke innført tools, function calling, skrivehandlinger, agent-loop,
routing, koordinering, handoff, minne, databasepersistens eller nye digitale
ansatte.

## Policy

| Menneskelig rolle | Digital ansatt | Capability | Effekt | Resultat |
| --- | --- | --- | --- | --- |
| `admin` | `borre` | `warehouse.read_summary` | read | tillatt |
| `lager` | `borre` | `warehouse.read_summary` | read | tillatt |
| ukjent/ugyldig | `borre` | `warehouse.read_summary` | read | avvist |
| alle | ukjent ansatt | alle | alle | avvist |
| alle | `borre` | ikke-deklarert capability | alle | avvist |

Autorisasjonen håndheves server-side. Provider og modell kan ikke kalles før
`WorkforceAuthorization` har returnert en eksplisitt tillatelse.

## Dataflyt

1. Ruten autentiserer med `requireRole(["admin", "lager"])`.
2. Eksisterende `validateChatInput` validerer spørsmål, side og historikk.
3. Runtime evaluerer menneskelig rolle × ansatt × capability.
4. `warehouse-summary`-provideren leser eksisterende Snake-kunnskap,
   dashboard-statistikk og inntil ti produkter uten lokasjon.
5. Børres eksisterende promptformat bygger meldingsrekkefølgen systemprompt,
   bakgrunnskontekst, historikk og spørsmål.
6. Eksisterende `gpt-5-mini` kalles én gang.
7. Ruten returnerer uendret `{ "answer": string }`. Run-ID legges bare i
   `x-workforce-run-id`-headeren.

## Automatisert verifisering

- 185 av 185 tester bestod etter rutemigreringen.
- Karakteriseringstestene låser fortsatt endpoint, metode, roller, input,
  modell, systemprompt, kontekst, meldingsrekkefølge, svarformat og read-only
  datatilgang.
- Provider-ekvivalenstesten låser samme operative verdier og tekstformat som
  den tidligere inline-ruten.
- Runtime-testene beviser fail-closed rekkefølge og at avviste kall ikke når
  provider eller modell.
- TypeScript bestod.
- ESLint bestod med 29 eksisterende warnings og ingen errors.

## Kontrollert test med ekte Snake-data

Testen brukte samme systemprompt, `gpt-5-mini`, eksisterende kontekstformat og
én eksplisitt `warehouse.read_summary` per kjøring. Datamengden var begrenset
til aggregerte lagertall, siste Shopify-sync og inntil ti produktnavn/SKU-er
uten lokasjon. Ingen kunde-, adresse-, betalings- eller credentialdata ble
sendt. Det ble gjort nøyaktig tre modellkall.

| Spørsmålstype | Resultat | Modelltid |
| --- | --- | ---: |
| Kort lagerstatus | Fullført; brukte operative nøkkeltall og Snake Health | 13 112 ms |
| Første prioritet | Fullført; prioriterte quantity diff i tråd med konteksten | 19 557 ms |
| Produkt-/lokasjonskontekst | Fullført; brukte faktiske produkter, SKU-er og antall fra konteksten | 20 851 ms |

Tre unike run-ID-er ble produsert, og telemetrien registrerte bare run-ID,
ansatt, capability, teknisk testaktør/rolle, tidspunkt, resultat, deklarerte
datakilder, modell og varighet. Spørsmål, prompt, kontekst, produktdata og
modellrespons ble ikke logget som run-metadata. Alle tre runs fikk resultat
`completed`, og kontrolltelleren viste tre forventede og tre faktiske
modellkall.

Testen kjørte runtime-en direkte med en read-only kopi av providerens faktiske
Snake-spørringer. HTTP-rutens autentiseringsavslag ble kontrollert separat og
returnerte eksisterende `401 { "error": "Ikke innlogget" }`. En full
autentisert browser-test ble ikke gjennomført fordi miljøet ikke hadde en
gjenbrukbar brukersesjon eller testkonto. Dette påvirker ikke den automatiserte
route-, auth- og kontraktdekningen, men betyr at testen ikke er en komplett
browser-til-database-måling.

Det finnes ingen meningsfull før/etter-latencybaseline for den gamle inline-
ruten. Tidene over er derfor observasjoner av modellventetid, ikke bevis på en
ytelsesendring. Konteksten var forhåndslastet i den kontrollerte harnessen, så
providerlatency kan ikke sammenlignes.

## Kjente begrensninger

- Runtime støtter bare Børre og én read-only capability per kjøring.
- Runs logges strukturert til serverlogg, men persisteres ikke.
- Det finnes ingen tools, writes, godkjenningsflyt eller koordinering.
- Ett manuelt svar foreslo prioritering etter salg/ordrepåvirkning, selv om
  disse dataene ikke var tilgjengelige i konteksten. Dette er eksisterende
  modell-/promptadferd og ble ikke endret i proof-of-conceptet.
- Produktbesvarelsen omtalte listen som sortert etter antall, men rekkefølgen
  var ikke konsekvent sortert. Dette ble ikke korrigert fordi Fase C ikke skal
  endre Børres synlige oppførsel eller prompt.
- Arne er urørt og bruker fortsatt sin eksisterende implementasjon.
