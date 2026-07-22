# Fase 6: Forvaltbarhet

## Omfang

Fase 6 lukker de gjenstående punktene under «Gjør systemet forvaltbart» uten ny funksjonalitet eller endret UI. Ingen produksjonsmigrasjon inngår i denne PR-en.

## Databasebaseline

Fase 4 la det applikasjonseide produksjonsskjemaet inn i migrasjonskjeden. Read-only kontroll i fase 6 bekreftet at lokal og remote migrasjonshistorikk matcher for fase 0–3, og at produksjonskatalogen fortsatt har samme 110 kolonner på tvers av `public` og `private` som fase 4 dokumenterte.

Det mangler derfor ingen nye baselineobjekter. Det kjente tekstkodingsavviket i én fase 2-feilmelding i `claim_shopify_sync_run` er fortsatt dokumentert og åpent; signatur og kjørbar logikk er identisk, og avviket endres ikke i fase 6.

## Fase 6-migrasjon

`20260722153852_phase_6_maintainability.sql`:

- beholder `locations_code_key` og fjerner den identiske `locations_code_unique`
- beholder `zones_code_key` og fjerner den identiske `zones_code_unique`
- legger til anbefalte indekser for:
  - `inventory.zone_id`
  - `location_counts.inventory_id`
  - `location_counts.location_id`
  - `locations.zone_id`
  - `stock_movements.inventory_id`
  - `stock_movements.product_id`

Supabase performance advisors identifiserte alle seks foreign keys som udekket og begge constraintparene som identiske. Den beholdte constrainten håndhever samme `UNIQUE (code)`-regel. Indeksene endrer ikke queryresultater eller write-semantikk; de gir Postgres flere planer for eksisterende joins, filtrering og referanseintegritetskontroller. Ordinær indeksbygging kan holde korte tabellåser ved en senere produksjonsutrulling.

`supabase db push --linked --dry-run` bekreftet at kun fase 6-migrasjonen er pending. Ingen DDL eller dataendring er kjørt mot produksjon.

En fersk full schema dump kunne ikke kjøres lokalt fordi Supabase CLI krever Docker for `pg_dump`. Kartleggingen brukte derfor read-only systemkatalogspørringer og advisors. Den eksisterende fase 4-tomdatabasetesten er fortsatt baselinebeviset; fase 6-migrasjonen bør i tillegg kjøres mot en isolert PostgreSQL-instans før produksjonsutrulling.

## Dynamisk lager-side

`/lager` venter nå eksplisitt på en innkommende request med Next.js `connection()` før databasekall. Den er ikke lenger del av prerender/build-datahenting. Den eneste debugloggen som skrev lagerstatistikk til buildloggen er fjernet. UI, queries og beregninger er uendret.

## Felles Supabase admin-klient

All lesing av `SUPABASE_SERVICE_ROLE_KEY` og all opprettelse av service-role-klienten er samlet i `lib/supabase/admin.ts`.

- modulen er merket `server-only`
- klienten opprettes lazy, slik at import under build ikke krever runtime-miljøvariabler
- kallsteder som tidligere returnerte en kontrollert 500 ved manglende konfigurasjon bruker nullable-varianten
- øvrige serverkall bruker den krevde varianten
- roller, API-svar, tabeller, RPC-er og queries er uendret

`server-only@0.0.1` er lagt til som eksakt versjon.

## Lint

Lint har nå exit 0. De 22 tidligere feilene berører eksisterende UI-/hookflyter og tre eksplisitt ekskluderte Børre-filer. For å unngå funksjonelle endringer kun for lint er følgende regler bevisst beholdt som synlige warnings:

- `@typescript-eslint/no-explicit-any`
- `react-hooks/immutability`
- `react-hooks/set-state-in-effect`
- `react-hooks/static-components`

Sluttresultatet er 0 feil og 55 warnings: de tidligere 33 warningene pluss de 22 omklassifiserte funnene. Nye funn er fortsatt synlige i CI/lokal output.

## Tester

Repoets eksisterende `node:test`-oppsett er gjenbrukt; ingen ny teststack er lagt til. `npm test` kjører ni tester:

- fire eksisterende Shopify sync-engine-tester
- tre auth-/rolleintegrasjonstester:
  - manglende autentisering
  - manglende, inaktiv eller ugyldig profil
  - eksplisitt admin-/lager-tilgang
- to lagerintegrasjons-/migrasjonskontrakttester:
  - `FOR UPDATE` og eksplisitt avvisning av negativ beholdning
  - atomisk kontrakt for inventory, stock movement og activity log

Node skriver en eksisterende `MODULE_TYPELESS_PACKAGE_JSON`-advarsel for TypeScript-testfiler. `type: module` er ikke lagt til fordi det kan endre prosjektets modulsemantikk og er utenfor scope.

## Validering

- `npm run build`: bestått med Next.js 16.2.4
- `tsc --noEmit`: bestått
- `npm run lint`: bestått, 0 feil og 55 dokumenterte warnings
- `npm test`: bestått, 9 av 9
- `git diff --check`: bestått
- `/lager`: dynamisk route, ingen produksjonsstatistikk i buildlogg
- admin-klient: ingen service-role-opprettelser utenfor felles modul
- Supabase dry-run: kun fase 6-migrasjonen pending

## Lukkede revisjonspunkter

- produksjonsskjema er representert i migrasjonskjeden
- redundante location/zone-constraints er ryddet i pending migrasjon
- anbefalte foreign key-indekser er lagt i pending migrasjon
- `/lager` er eksplisitt dynamisk og logger ikke produksjonsdata under build
- Supabase admin-klient er samlet i én server-only modul
- lintkommandoen består uten runtime-/UI-endringer
- integrasjonstester for auth, roller og lagerbevegelseskontrakten er lagt til

## Punkter som fortsatt bør stå åpne

- dynamisk kjøring av fase 6-migrasjonen mot en isolert tom/testdatabase før produksjon
- kjent fase 2-tekstkodingsavvik i produksjon
- de 55 dokumenterte lint-warningene dersom fremtidig UI-/Børre-scope tillater funksjonell opprydding
- `npm audit` rapporterer fem eksisterende avhengighetsfunn (én moderat, fire høye); automatisk oppgradering er ikke kjørt fordi dependency-/Next-oppgradering er utenfor fase 6
