# Fase 2: robust Shopify-sync

## Avgrensning

Fase 2 endrer kun Shopify-produkt-sync, tilhørende statusrespons og nødvendig
databaseinfrastruktur. Auth, eksisterende RLS-policyer, Børre, Arne, Viper og
lageroperasjoner er ikke endret.

## Hvorfor dagens sync passerer Vercels tidsgrense

Den gamle syncen hentet 100 aktive Shopify-varianter per side. For hver variant
utførte den sekvensielt:

1. én produkt-upsert,
2. én sletting av eksisterende collection-koblinger,
3. eventuelt én collection-upsert.

Produksjonsdatabasen har 1 231 produkter. Omtrent 13 Shopify-sider kunne derfor
utløse mer enn 2 400 sekvensielle databasekall i samme Vercel-invocation.
Cursor og tellere lå bare i minnet. Vercel Observability viste sju timeouts på
`/api/cron/shopify-sync`, alle etter 300 sekunder, i perioden 7.–21. juli 2026.

Ved timeout var noen produkter allerede oppdatert, mens cursor, sluttavstemming
og fullført-/feilstatus manglet.

## Ny flyt

1. Ruten claimer enten en ny kjøring eller en tidligere avbrutt/feilet kjøring.
2. En tidsbegrenset lease sikrer at bare én manuell eller planlagt worker jobber
   på kjøringen.
3. Shopify-varianter hentes cursorbasert, 100 om gangen og sortert på ID.
4. Hele siden sendes til én database-RPC. Produkter, collections, settet med
   observerte variant-ID-er, cursor og tellere oppdateres i samme transaksjon.
5. Etter siste side kjører en egen avsluttende RPC avstemming og markerer først
   deretter kjøringen som `completed`.
6. Shopify-koblede produkter som ikke ble observert i den komplette aktive
   katalogen markeres `active = false` og `shopify_status = 'NOT_ACTIVE'`.
   Dette dekker draft, arkivert, slettet og andre produkter som ikke lenger
   returneres som aktive.

Ved en kontrollert pause frigjøres leasen, mens status og cursor beholdes. Ved
hard timeout utløper leasen automatisk. Neste autoriserte kall overtar samme
kjøring og fortsetter fra siste atomisk lagrede cursor.

## Databaseendringer

Migrasjon:

- `supabase/migrations/20260721161455_phase_2_shopify_sync.sql`

Migrasjonen oppretter:

- `private.sync_runs`: status, start/slutt, cursor, fremdrift, tellere,
  feilmelding og worker-lease.
- `private.sync_run_variants`: variant-ID-er observert i hver kjøring.
- unik constraint på `products.shopify_variant_id`.
- service-role-only RPC-er for claim, sidebatch, pause, feil, status og
  sluttavstemming.

Tabellene er i `private`, og RPC-ene er eksplisitt revoked fra `public`, `anon`
og `authenticated`. Eksisterende auth og RLS-policyer endres ikke.

## Teknisk identitet

Produksjonskontrollen før implementasjon viste:

- 1 228 av 1 231 produkter har `shopify_variant_id`.
- ingen variant-ID-er er duplisert.
- tre rader uten variant-ID er lokale produkter.
- 29 produkter har lagerrelasjoner.

Syncen slår derfor først opp på Shopify variant-ID. SKU brukes bare som fallback
for å adoptere en eksisterende eldre rad som ennå ikke er koblet til variant-ID.
Den lokale `products.id` beholdes, slik at inventory, bevegelser og collections
ikke mister relasjoner. SKU er fortsatt unikt i dagens skjema; eventuelle
duplikate Shopify-SKU-er gir en tydelig feil i stedet for feil sammenkobling.

## Vercel-tidsbudsjett

Rutene deklarerer `maxDuration = 300`. Orchestratoren bruker en myk grense på
240 sekunder. Normal kjøring reduseres fra tusenvis av nettverksrunder til ca.
13 Shopify-kall og 13 database-RPC-er. Hvis den myke grensen nås, pauses
kjøringen kontrollert før Vercels harde grense og kan startes igjen umiddelbart.

## Feilhåndtering og samtidighet

- En partial unique index tillater kun én `running` kjøring.
- Claim bruker en transaction-level advisory lock for å lukke race mellom cron
  og manuell start.
- Cursor-konflikt og ugyldig/utløpt lease avvises i databasen.
- Sidebatchen er atomisk; cursor flyttes aldri hvis produktbatchen feiler.
- Vanlige feil setter kjøringen til `failed` med feilmelding og aktivitetslogg.
- Hard timeout oppdages som utløpt lease ved neste claim og logges som resume.
- Fullført-status settes i samme transaksjon som sluttavstemmingen.

## Lokal validering

Kjør:

```powershell
node --test lib/shopify/sync-engine.test.ts
npx tsc --noEmit --pretty false
npx eslint lib/shopify/sync-engine.ts lib/shopify/sync-engine.test.ts `
  lib/shopify/sync-products.ts app/api/shopify/sync-products/route.ts `
  app/api/cron/shopify-sync/route.ts `
  app/components/products/useProductsActions.ts
git diff --check
```

Testene dekker:

- full sync med to sider og fullføring først etter siste side,
- kontrollert avbrudd etter første side og resume fra lagret cursor,
- feil under sidehenting og eksplisitt feilmarkering,
- avvisning uten Shopify-/databasearbeid når en annen worker eier leasen.

Docker og lokal PostgreSQL er ikke tilgjengelig i arbeidsmiljøet. Migrasjonen er
derfor statisk reviewet, men ikke kjørt lokalt eller mot produksjon.

Full `npm run lint` er også kjørt. Repositoryet har eksisterende lintgjeld
utenfor Shopify-syncen (37 feil og flere advarsler i blant annet SnakeNav,
RoleGate, lager-/produkt-/SPM-sider og Børre-hjelpere). Disse er ikke endret i
fase 2. Målrettet lint for alle fase 2-filer er grønn.

## Utrulling og manuell kontroll

Appkoden avhenger av de nye RPC-ene. Migrasjonen må derfor kjøres før den nye
appversjonen aktiveres. Anbefalt kontrollert rekkefølge:

1. ta databasebackup og bekreft at `shopify_variant_id` fortsatt er uten
   duplikater,
2. kjør migrasjonen,
3. deploy appkoden,
4. start en manuell sync og bekreft `running` → `completed`,
5. bekreft at cron og manuell start ikke kan eie lease samtidig,
6. avbryt en testkjøring etter én side og bekreft resume fra samme run/cursor,
7. sett et testprodukt til draft/arkivert i Shopify og bekreft at det først
   deaktiveres etter en komplett avsluttende avstemming,
8. kontroller at inventory og andre relasjoner beholder samme lokale produkt-ID.

Migrasjonen skal ikke kjøres i produksjon som del av denne PR-en.
