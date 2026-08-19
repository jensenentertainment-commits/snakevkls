# Snake OS — teknisk drifts- og overleveringsrunbook

Sist verifisert: 19. august 2026

Denne runbooken beskriver minste praktiske prosess for deployment, rollback,
recovery og senere overføring av teknisk eierskap. Den inneholder ingen
secret-verdier.

## Systeminventar

| Område | Verifisert referanse | Bruk |
| --- | --- | --- |
| GitHub | `jensenentertainment-commits/snakevkls`, remote `origin` | Autoritativ kildekode og offsite Git-backup |
| Hovedbranch | `master`, tracking `origin/master` | Baseline for ordinær release |
| Vercel | project `prj_p7aUoyUMbI3F7oOJdR6VDAny9hiY`, team `team_deGLCjsYl8W5zeBcEMMqH0ZF` | Next.js build, Functions og Shopify-sync cron |
| Supabase | `vk-lager`, project ref `gcjvaeqjkrrrzrdccrrv` | PostgreSQL, Auth og RLS |
| Shopify | Butikken angitt av `SHOPIFY_STORE_DOMAIN` | Varekompaniets nettbutikk/salgskanal |
| OpenAI | Konto/prosjekt bak `OPENAI_API_KEY` | Børre og Arnes eksisterende modellkall |

GitHub-repositoryets kontonavn fremstår personlig. Repoet kan ikke bevise hvem
som juridisk eier eller administrerer GitHub-, Vercel-, Supabase-, Shopify- og
OpenAI-kontoene. Dette må kontrolleres manuelt i hvert systems medlems-/billing-
innstillinger.

## Environment variables

Følgende navn brukes av runtime. Verdier administreres i Vercel for deployede
miljøer og i en ignorert `.env.local` for godkjent lokal utvikling:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_API_VERSION`
- `SHOPIFY_SCOPES`
- `SHOPIFY_REDIRECT_URI`
- `CRON_SECRET`
- `WAREHOUSE_SALES_WORKER_SECRET`
- `VIPER_SHOPIFY_IMPORT_ENABLED`
- `OPENAI_API_KEY`

`SUPABASE_SERVICE_ROLE_KEY`, Shopify-secret/token, cron-/worker-secret og
OpenAI-nøkkel er server-secrets. De skal aldri gis `NEXT_PUBLIC_`-prefiks,
skrives i Git, logger eller dokumentasjon. Shopify OAuth access token lagres i
Supabase-tabellen `shopify_connections` og skal roteres gjennom kontrollert
reautorisering.

## Normal release

1. Bekreft godkjent release-scope og rent arbeidstre.
2. Kjør `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` og
   `git diff --check`.
3. Kontroller pending migrasjoner med
   `supabase db push --linked --dry-run`.
4. Ta og verifiser databasebackup før schemaendringer.
5. Bruk godkjent Supabase-operatør til å anvende migrasjoner i kronologisk
   rekkefølge. Future Foundation-schemaet må være på plass før appversjonen som
   leser `pick_priority` og `pick_sequence` aktiveres.
6. Push bare etter eksplisitt godkjenning. Bekreft i Vercel om Git-push faktisk
   utløser automatisk deployment; repoet inneholder ingen GitHub Actions-flow
   som beviser dette.
7. Kontroller Vercel build/runtime-logger, login, lager, soner/lokasjoner,
   Shopify-sync, Viper og lagersalg etter release.

En Git-push er ikke i seg selv godkjenning av produksjonsdeploy. Operatøren må
kontrollere Vercel-prosjektets Git-/production-branch-innstillinger først.

## Rollback

1. Stans nye berørte operasjoner dersom dataintegritet kan påvirkes.
2. Reverter appcommit med en ny, eksplisitt `git revert` og deploy den grønne
   versjonen gjennom normal releaseprosess. Ikke force-push eller omskriv
   `master`.
3. Ikke slett eller rediger anvendt migrasjonshistorikk. Database-rollback skal
   gjøres som en ny, vurdert migrasjon eller ved full recovery fra verifisert
   backup når dette er nødvendig.
4. For Viper physical ordering: eksisterende materialiserte jobber skal ikke
   rematerialiseres. Ved feil stanses ny import mens funksjonskontrakten rettes.
5. Dokumenter hendelse, valgt commit, databasehandling og verifikasjonsresultat.

## Databasebackup, export og recovery

Før hver schemarelease skal ansvarlig operatør:

1. Kontrollere Supabase-planens faktiske automatiske backup/PITR-status og
   retention i dashboardet. Dagens innstilling er ikke bevist av repoet.
2. Ved behov ta separat eksport med Supabase CLI, for eksempel schema og data
   til godkjent, kryptert lagring utenfor repositoryet:
   `supabase db dump --linked --file <godkjent-absolutt-sti>`.
3. Beskytte eksporten som produksjonsdata. `*.dump` og `*.backup` er ignorert av
   Git og skal ikke committes.
4. Teste restore i et isolert prosjekt/database, aldri direkte over produksjon.
5. Verifisere migrasjonshistorikk, tabell-/radantall, RLS, kritiske RPC-er og
   auth-avhengigheter før et gjenopprettet miljø tas i bruk.

Recovery til produksjon krever eksplisitt beslutning om recovery point,
akseptabelt datatap, målprosjekt og DNS/deployment-cutover.

## Secret rotation

1. Identifiser alle konsumenter og planlegg et kort overlappsvindu dersom
   leverandøren støtter to aktive nøkler.
2. Opprett ny secret hos leverandøren.
3. Oppdater riktige Vercel-miljøer og godkjent lokal konfigurasjon uten å logge
   verdien.
4. Redeploy bare etter separat deploygodkjenning og verifiser berørt flyt.
5. Revoke gammel secret og kontroller logger for feil eller misbruk.

Shopify OAuth-token roteres ved kontrollert reinstallasjon/reautorisering.
Supabase service role-rotasjon krever gjennomgang av alle serverfunksjoner.
`CRON_SECRET` og `WAREHOUSE_SALES_WORKER_SECRET` skal forbli separate.

## Overføring til Outlet Service AS

Før overføring opprettes en verifisert inventarliste med primær og sekundær
Outlet Service-admin for GitHub, Vercel, Supabase, Shopify, OpenAI og domene/DNS.
Deretter:

1. Legg til virksomhetskontrollerte adminbrukere og MFA før personlig tilgang
   fjernes.
2. Flytt repository/prosjekter til godkjente organisasjoner når leverandøren
   støtter det, og bekreft remote-/project-link etter flytting.
3. Overfør billing, recovery-kontakter, domene/DNS og password-manager-poster.
4. Roter secrets som personlige administratorer kan ha hatt tilgang til.
5. Test backup/restore og en ordinær release med Outlet Service-eierskap.
6. Fjern tidligere personlig tilgang først etter dokumentert godkjenning.

## Må verifiseres manuelt

- juridisk/administrativ eier, billing og MFA for alle eksterne kontoer
- Vercels production branch, Git-trigger, environment scopes og domener
- Supabase backup/PITR-retention, databasepassord og recovery-kontakter
- Shopify app-eierskap, scopes, callback-domene og token-rotasjonsprosedyre
- OpenAI organization/project, usage limits og billing
- domene/DNS-registrar, eierskap, tilgang og rollback
- hvem som er primær/sekundær driftsansvarlig hos Outlet Service AS
