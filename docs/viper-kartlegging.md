# Teknisk kartlegging: Viper i Snake OS

## Sammendrag

Viper finnes i dag som produktidé og navigasjonsintensjon, men ikke som implementert arbeidsflyt.

Det finnes:

- Et brukbart fundament for produkter, Shopify-varianter, fysisk lagerbeholdning, soner og lokasjoner.
- Atomiske lageroperasjoner med historikk.
- Shopify-produktimport med gjenopptakbar synkronisering.
- Autentisering, to roller og grunnleggende RLS.
- UI for produkter, plassering, telling, lageravvik og aktivitetslogg.
- Snake Intelligence-signaler som vurderer datakvalitet før plukk aktiveres.

Det mangler:

- Ordremodell og ordrelinjer.
- Shopify-ordreimport og webhooks.
- Reservasjon og beregnet tilgjengelig beholdning.
- Plukkoppdrag, plukklinjer, tildeling og tilstandsmaskin.
- Avvik knyttet til ordre og plukk.
- Ferdigstillelse, pakking, forsendelse og PostNord.
- Viper-side, API-er, tjenester og dedikerte komponenter.
- En rollemodell som skiller plukker, arbeidsleder og administrator.

Konklusjonen er at Viper ikke bør bygges som en ny side oppå dagens `inventory.quantity`. Det bør bygges som et eget arbeidsflytdomene med eksplisitte ordre-, reservasjon-, plukk- og avviksmodeller, men gjenbruke eksisterende produkt-, lokasjons-, autentiserings- og aktivitetsgrunnlag.

Kartleggingen var read-only. Ingen filer, migrasjoner, databaseobjekter eller produksjonsdata ble endret. Arbeidstreet hadde bare den forhåndseksisterende, usporede `supabase/.temp/`-mappen før denne rapportfilen ble opprettet.

---

## 1. Grunnlag og avgrensning

Funnene bygger på:

- Gjeldende arbeidstre på `master`, commit `23b80e2`.
- Alle fem migrasjoner under `supabase/migrations`.
- App Router-ruter, API Route Handlers, komponenter, hooks og tjenester.
- Git-historikken på alle lokale og kjente eksterne grener.
- Eksisterende fase-/revisjonsdokumentasjon.

Repositoryet dokumenterer at produksjonsdatabasen tidligere ble inspisert read-only, og at baseline den gangen samsvarte med produksjonskatalogen. Det ble ikke etablert en ny databaseforbindelse i denne kartleggingen. Rapporten kan derfor dokumentere repositoryets datamodell og den tidligere verifiserte baselinen, men ikke garantere at produksjonen ikke har driftet etter denne inspeksjonen. Se [`docs/phase-4-database-baseline.md`](./phase-4-database-baseline.md).

---

# 2. Dagens datagrunnlag

## 2.1 Tabelloversikt

| Tabell | Formål | Relevans for Viper | Viktigste begrensning |
|---|---|---|---|
| `products` | Én lokal rad per produktvariant | Produktidentitet og SKU | Duplicerer produktnivådata per variant |
| `product_collections` | Shopify collections per produktvariant | Filtrering/prioritering | Ikke et ordre- eller allokeringsbegrep |
| `zones` | Lagerområder | Grov plukkstruktur | Ingen rekkefølge, type eller hierarki |
| `locations` | Fysiske lagerplasser | Plukkadresse | Ingen kapasitet eller plukksekvens |
| `inventory` | Beholdning per produkt/lokasjon | Fysisk beholdning | Ingen reservasjon eller tilgjengelig antall |
| `stock_movements` | Append-only beholdningshendelser | Trekk ved fullført plukk | Ingen ordre-/plukk-referanse |
| `location_counts` | Resultat fra lokasjonstelling | Lagerkorreksjon og kontroll | Telling endrer ikke lager automatisk |
| `activity_log` | Operasjonell aktivitetslogg | Revisjonsspor | Tillater ikke ordre/plukk som entity type |
| `profiles` | Bruker, aktiv-status og rolle | Tilgang/tildeling | Bare `admin` og `lager` |
| `shopify_connections` | Shopify access token | Integrasjonsgrunnlag | Token lagret i database; service-role-tilgang |
| `snakeboard_messages` | Interne beskjeder | Mulig operativ kommunikasjon | Ikke oppgave- eller arbeidsflytmodell |
| `private.sync_runs` | Shopify produktsynk | Integrasjonsmønster som kan gjenbrukes | Bare produktsynk |
| `private.sync_run_variants` | Varianter sett i synkkjøring | Idempotent katalogavstemming | Ikke relevant for ordretilstand |

Definisjonene finnes i [`database-baselinen`](../supabase/migrations/20260719000000_phase_0_database_baseline.sql), [`Shopify-migrasjonen`](../supabase/migrations/20260721171117_phase_2_shopify_sync.sql) og [`lagerintegritetsmigrasjonen`](../supabase/migrations/20260721172143_phase_3_inventory_integrity.sql).

Det finnes ingen tabeller som heter eller tilsvarer:

- `orders`
- `order_lines`
- `reservations`
- `allocations`
- `pick_jobs`
- `pick_tasks`
- `pick_lines`
- `pick_events`
- `pick_exceptions`
- `shipments`
- `packages`

## 2.2 Produkter og varianter

`products` inneholder:

- Lokal UUID.
- Unik, men nullable `sku`.
- `product_name` og nullable `variant_name`.
- Aktiv-status.
- Shopify product-, variant- og inventory-item-ID.
- Shopify-status og synktidspunkt.
- Produktbilde, leverandør, produkttype og collections.
- `shopify_quantity`.

Variantstrukturen er i praksis flat:

```text
Shopify product
 ├─ variant A → products-rad A
 └─ variant B → products-rad B
```

Det finnes ingen separat lokal `product`- og `variant`-modell. Alle varianter er selvstendige `products`-rader, mens produktnavn, bilde, vendor og type blir duplisert.

Identitet ved synkronisering:

1. Match på `shopify_variant_id`.
2. Hvis ingen treff, match på SKU.
3. Variant uten SKU blir registrert som sett i synkkjøringen, men hoppes over dersom den ikke allerede finnes lokalt.
4. Shopify-varianter som ikke finnes i en fullført aktiv-katalogsynk, deaktiveres lokalt.

`shopify_variant_id` er unik. SKU er også unik når den ikke er `NULL`. Dette er et godt grunnlag for ordrelinjematching, men Viper må lagre et snapshot av SKU, navn og variant på ordrelinjen. Historiske ordre må ikke endre betydning når produktkatalogen oppdateres.

## 2.3 Lokasjoner og soner

`zones` har:

- `id`
- unik `code`
- `name`
- `active`
- tidsstempler

`locations` har:

- `id`
- unik `code`
- `active`
- nullable `zone_id`
- tidsstempler

Et produkt kobles til lokasjon gjennom `inventory`:

```text
products 1 ─── * inventory * ─── 1 locations
                         └─────── 1 zones
```

`inventory.zone_id` kan eksistere uten `location_id`. Dette brukes i dagens totrinnsflyt:

1. Sett sone.
2. Sett eksakt lokasjon senere.

### Kapasitet

Det finnes ingen lagret kapasitet, dimensjon, vektgrense, antallsgrense eller lokasjonstype.

Lokasjonsdetaljsiden beregner bare et UI-signal for «høy belastning» når en lokasjon har minst åtte produktlinjer eller totalt minst 50 enheter. Dette er en presentasjonsheuristikk, ikke kapasitet, i [`app/locations/[code]/page.tsx`](../app/locations/[code]/page.tsx).

Det finnes heller ikke:

- Plukksekvens.
- Gang/reol/hylle som separate felt.
- Buffer-, bulk-, karantene- eller plukklokasjonstype.
- Enhets-/volumkapasitet.
- Prioritet mellom flere lokasjoner for samme SKU.

## 2.4 Lagerbeholdning

`inventory.quantity` er fysisk registrert beholdning per produkt og lokasjon.

Viktige regler:

- Mengden kan ikke være negativ.
- Maks én rad per produkt/lokasjon.
- Maks én `is_primary = true`-rad per produkt.
- Samme produkt kan ligge på flere lokasjoner.
- Lagerendringer bruker databasefunksjoner med radlås.
- En forventet mengde kan sendes inn for optimistisk samtidighetskontroll.
- Uttak som ville gitt negativ beholdning avvises.

`stock_movements` registrerer delta, årsak, notat og produkt/inventory-referanse. Dagens årsaker er:

- `manual_sale`
- `waste`
- `internal_use`
- `correction`
- `receiving`
- `other`

Det finnes ingen årsak for plukk, kansellering, reservasjon, frigivelse eller retur.

### Fysisk, reservert og tilgjengelig

Dagens modell har bare:

```text
fysisk beholdning = inventory.quantity
```

Det finnes ikke:

```text
reservert = SUM(aktive reservasjoner)
tilgjengelig = fysisk − reservert
```

Konsekvensen er at to samtidige ordre kan se samme lager som tilgjengelig. Negativ-kontrollen ved faktisk uttak hindrer minusbeholdning, men den hindrer ikke oversalg eller at en plukker kommer til en vare som allerede er brukt av en annen ordre.

### Shopify-differanser

Systemet beregner:

```text
Shopify quantity − SUM(lokal inventory.quantity)
```

Dette er et avvikssignal, ikke en avstemmingsmodell. Produktlisten bruker enkelte steder bare `inventory[0]`, mens dashboardet summerer alle lokasjoner. Dette kan gi forskjellige avviksbilder for produkter på flere lokasjoner.

Shopify-synken importerer `inventoryQuantity`, men lageroperasjoner i Snake sender ikke beholdningsendringer tilbake til Shopify. Det er dermed ingen full toveis beholdningssynk i repositoryet.

## 2.5 Telling og differanser

`location_counts` lagrer:

- forventet antall
- telt antall
- generert differanse
- notat
- hvem som telte
- tidspunkt

Lagringen kontrollerer at beholdningen ikke har endret seg mellom lasting og innsending. Telling oppdaterer med vilje ikke `inventory.quantity` automatisk. En eventuell korreksjon må gjøres separat.

Dette er en god sikker egenskap og bør gjenbrukes ved plukkavvik: observasjon og beslutning bør være separate hendelser.

---

# 3. Ordregrunnlag

## Finnes ordremodellen?

Nei.

Det finnes ingen ordre- eller ordrelinjemodell i migrasjonene, TypeScript-typene, API-rutene eller git-historikken.

Dashboardet har et kort for «Ordre» som peker til `/ordre`, men ruten finnes ikke. Beskrivelsen sier «Manuelle ordre og salg utenfor Shopify», uten underliggende implementasjon, i [`app/dashboard/page.tsx`](../app/dashboard/page.tsx).

## Manglende ordreegenskaper

Følgende har ingen representasjon:

- Shopify order ID og order number.
- Ordrekilde.
- Kunde og leveringsadresse.
- Ordrelinjer.
- Bestilt, kansellert, reservert og plukket antall.
- Betalings- og fulfillment-status.
- Fraktmetode.
- Prioritet, frist eller ekspress.
- Tags og ordrenotater.
- Delvis fulfillment.
- Idempotensnøkkel/webhook-ID.
- Importstatus og importfeil.
- Ordrestatus i Snake.
- Tildelt plukker.
- Ferdigstillelse eller forsendelse.

---

# 4. Eksisterende Viper

## Implementasjonsstatus

| Del | Status |
|---|---|
| Side/rute `/viper` | Mangler |
| Side/rute `/ordre` | Mangler |
| Viper-komponenter | Mangler |
| Viper-hooks | Mangler |
| Viper-services | Mangler |
| Viper API-ruter | Mangler |
| Viper-databasetabeller | Mangler |
| Viper-RPC-er | Mangler |
| Viper-RLS | Mangler |
| Edge Functions | Ingen |
| Server Actions | Ingen i hele appen |
| Feature flag | Ingen generell feature-flag-infrastruktur |
| Git-historikk med Viper-filer | Ingen funnet |
| PostNord | Ingen kode eller konfigurasjon funnet |

### Eksisterende referanser

Viper omtales i:

- Dashboardkortet `/viper`.
- Snake sin statiske kunnskapsbase som et fremtidig område for ordre og plukk.
- Utviklingskontekst for Børre/Arne.
- AskBørre-komponenten, som tillater widgeten på `/viper`.
- Lagerdashboardet, der plukk er merket «Snart».
- Snake Intelligence, der `pickEnabled` alltid sendes som `false`.

Den faktiske funksjonelle markøren finnes i [`SnakeIntelligencePanel.tsx`](../app/components/SnakeIntelligencePanel.tsx). Dette er en hardkodet tilstand, ikke et administrerbart feature-flagg.

## Navigasjonsmessig inkonsistens

- Dashboardet viser Viper som om modulen kan åpnes.
- Hovednavigasjonen har ingen Viper-lenke.
- `/viper` finnes ikke og vil gi 404 etter at proxyen har godkjent brukeren.
- `/ordre` har samme problem.
- Lagerflaten kommuniserer samtidig tydelig at plukk ikke er aktivt.

Viper bør ikke eksponeres som aktiv dashboardhandling før det finnes minst en fungerende ordrekø.

---

# 5. Dagens arbeidsflyt fra ordre til ferdig plukk

| Arbeidssteg | Dagens støtte | Vurdering |
|---|---|---|
| Mottatt ordre | Ingen ordreimport eller modell | Mangler |
| Validert ordre | Produkter kan identifiseres med variant-ID/SKU | Bare fundament |
| Klar til plukk | Ingen reservasjon eller readiness-regel | Mangler |
| Plukk startet | Ingen oppgave, claim eller plukker | Mangler |
| Plukk pågår | Lager kan slås opp etter SKU/lokasjon | Bare verktøy, ikke flyt |
| Linje plukket | Manuelt lageruttak finnes | Ikke knyttet til ordre |
| Avvik | Generelle lageravvik beregnes i klienten | Mangler ordre-/plukkavvik |
| Plukk ferdig | Ingen tilstand eller fullføringsoperasjon | Mangler |
| Lager trukket | Atomisk lageruttak finnes | Kan gjenbrukes, må kobles til plukk |
| Ordre fullført | Ingen ordrestatus/fulfillment | Mangler |
| Forsendelse | Ingen pakke/PostNord-modell | Mangler |
| Shopify fulfillment | Ingen fulfillment-integrasjon | Mangler |

Dagens system støtter altså forberedelsene til plukk—produktidentitet, plassering, lagerkvalitet og korrigering—men ingen del av selve ordrearbeidsflyten.

---

# 6. Brukeropplevelse og operativ støtte

## Eksisterende UI som kan gjenbrukes

- Produktsøk med SKU, produkt, variant, collection, sone og lokasjon.
- Produktdetalj.
- Sone- og lokasjonsadministrasjon.
- Lokasjonsdetalj med produkter og antall.
- Ryddemodus for varer uten plassering.
- Lokasjonstelling.
- Lageravvik.
- Aktivitetslogg.
- Toast, modaler, hero, toolbar og øvrige visuelle byggeklosser.
- Responsiv produktvisning.

Sentrale filer:

- [`app/products/page.tsx`](../app/products/page.tsx)
- [`app/components/products/utils.ts`](../app/components/products/utils.ts)
- [`app/components/products/useProductsActions.ts`](../app/components/products/useProductsActions.ts)
- [`app/locations/[code]/page.tsx`](../app/locations/[code]/page.tsx)
- [`app/location-count/page.tsx`](../app/location-count/page.tsx)
- [`app/issues/page.tsx`](../app/issues/page.tsx)
- [`app/activities/page.tsx`](../app/activities/page.tsx)

## Avvik

Dagens «Avvik» er ikke en lagret avviksmodell. Listen beregnes i klienten fra produkter og lokasjoner:

- Produkt uten sone.
- Produkt uten lokasjon.
- Produkt uten SKU.
- Produkt på flere lokasjoner.
- Lokasjon uten sone.
- Tom lokasjon.

Det finnes ingen:

- Avvikseier.
- Status eller løsning.
- Kommentarhistorikk.
- SLA/alder.
- Kobling til ordre eller plukk.
- Sperring/frigivelse.
- Godkjenning.

Viper trenger en separat, persistert avviksmodell. Dagens issues-side kan fortsatt være et datakvalitetsdashboard.

## Aktivitetslogg

`activity_log` er append-only for operative brukere og inneholder gode revisjonsdata. UI-et viser de siste 100 hendelsene og grupperer dem per dato.

Begrensninger for Viper:

- `entity_type`-constrainten tillater ikke `order`, `pick`, `reservation`, `exception` eller `shipment`.
- Ingen sammenhengende correlation/causation-ID.
- Metadata er fleksibel JSON, men ikke en erstatning for domenetabeller.
- UI-et har ingen ordre- eller plukkfiltrering.

## Snake Intelligence

Snake Intelligence vurderer:

- Manglende lokasjon.
- Shopify/lokal beholdningsdifferanse.
- Lokasjon uten sone.
- Antall plasserte produkter.
- Lagerhelse.

Dette er relevant som en pre-flight-kontroll før Viper aktiveres. Det bør senere utvides med:

- Antall ordre som venter.
- Eldste ordre.
- Ordre blokkert av lager.
- Plukkavvik.
- Gjennomsnittlig plukktid.
- Ordre per plukker.
- Reservasjoner som har utløpt.
- Shopify-import- og fulfillment-feil.

Snake Intelligence bør lese operasjonelle visninger eller aggregeringer, ikke eie Viper-reglene.

---

# 7. Tilgangsstyring og sikkerhet

## Dagens modell

Tilgang krever:

1. Gyldig Supabase-bruker.
2. Profil.
3. `active = true`.
4. Rollen `admin` eller `lager`.

API-ruter bruker `requireRole` før de eventuelt oppretter en service-role-klient. Dette er et godt og viktig mønster, se [`lib/auth/require-role.ts`](../lib/auth/require-role.ts).

Proxyen beskytter vanlige sider, men ekskluderer alle `/api`-ruter. Hver API-rute må derfor håndheve sin egen sikkerhet. De operative rutene gjør i hovedsak dette. Shopify callback og cron bruker henholdsvis OAuth-verifisering og cron-hemmelighet.

## RLS

Godt:

- RLS er aktivert på alle offentlige tabeller.
- `inventory`, `locations`, `zones`, `stock_movements` og `activity_log` bruker aktiv profil og roller.
- Historikktabeller er append-only.
- `private.has_role` ligger i privat skjema og kontrollerer `auth.uid()`.
- Lager-RPC-ene er `security invoker`.
- Shopify-syncens `security definer`-funksjoner er bare gitt til `service_role`.

Svakheter:

- `products` og `product_collections` har fortsatt brede `TO authenticated USING (true)`-lesepolicyer. De kontrollerer ikke aktiv profil.
- Flere baselinetabeller har brede tabellgrants, men ingen brukbare RLS-policyer. RLS stopper tilgang, men privilegiene er unødvendig vide og vanskeliggjør revisjon.
- Nåværende roller skiller ikke mellom å plukke, administrere kø, korrigere lager og håndtere avvik.
- Klientbasert `RoleGate` er et UI-lag, ikke en sikkerhetsgrense.
- `service_role` brukes mye i operative Route Handlers. Hver ny Viper-rute må derfor ha eksplisitt auth, ressursautorisasjon og inputvalidering.
- `activity_log.actor_*` tas gjennom service-role-RPC-er fra API-laget. Viper bør hente identitet fra verifisert sesjon og ikke stole på klientlevert aktørinformasjon.

## Anbefalt Viper-tilgang

Ikke legg hele Viper under samme `lager`-rettighet uten operasjonelle regler.

Minimum:

| Kapabilitet | Admin | Arbeidsleder | Plukker |
|---|---:|---:|---:|
| Se ordrekø | Ja | Ja | Ja, relevant kø |
| Claim/start plukk | Ja | Ja | Ja |
| Plukke linjer | Ja | Ja | Ja, tildelt oppdrag |
| Frigi eller omfordele oppdrag | Ja | Ja | Nei |
| Overstyre reservasjon | Ja | Begrenset | Nei |
| Godkjenne avvik | Ja | Ja | Registrere |
| Kansellere ordre | Ja | Eventuelt | Nei |
| Administrere integrasjon | Ja | Nei | Nei |

Dette krever enten flere roller eller, helst, roller kombinert med kapabiliteter.

---

# 8. Tekniske avhengigheter

## Avhengighetskart

```text
Shopify Admin API
    │
    ├── OAuth connection
    └── ProductVariants GraphQL
             │
             ▼
    Shopify sync service
             │
             ▼
 private.sync_runs ──► products ──► product_collections
                          │
                          ▼
                       inventory
                      /         \
                  locations    stock_movements
                     │               │
                   zones         activity_log
                      \             /
                       \           /
                        Snake UI
          products / locations / issues / counting
                              │
                              ▼
                    Snake Intelligence
```

Fremtidig Viper bør kobles slik:

```text
Shopify order webhook/pull
          │
          ▼
  ordre-ingest + idempotens
          │
          ▼
 orders ─── order_lines
          │
          ▼
 allocation/reservations
          │
     ┌────┴────┐
     ▼         ▼
 inventory   pick_jobs ── pick_tasks
     │             │
     │             ├── pick_events
     │             └── pick_exceptions
     │
     └──── atomic completion transaction
                    │
                    ▼
          shipment / fulfillment outbox
             │                 │
             ▼                 ▼
          PostNord          Shopify
```

## App-lag

| Lag | Dagens implementasjon |
|---|---|
| Next.js | App Router, Next.js 16.2.4 |
| Sider | Server Components og mange store klientkomponenter |
| Mutasjoner | Route Handlers, ikke Server Actions |
| Klientdata | Direkte Supabase-spørringer fra Client Components |
| Autorisasjon | Proxy + `requireRole` + RLS |
| Privilegert data | Lazy service-role-klient |
| Domenelogikk | Dels database-RPC, dels API-ruter, dels klient |
| Hooks | Primært produktfiltrering og produktoperasjoner |
| Services | Shopify og Intelligence |
| Edge Functions | Ingen |
| Realtime | Ikke brukt |
| Kø/worker | Kun resumable Shopify-sync via cron/invocation |

## API-ruter som kan være relevante

- `/api/inventory/stock-movement`
- `/api/inventory/set-location`
- `/api/inventory/batch-zone`
- `/api/locations/add-product`
- `/api/locations/remove-product`
- `/api/locations/update-quantity`
- `/api/location-count`
- `/api/location-count/complete`
- `/api/shopify/sync-products`
- `/api/cron/shopify-sync`
- `/api/snake-intelligence/signals`

Det finnes ingen Viper- eller ordre-API-er.

---

# 9. Integrasjoner

## Shopify

Dagens Shopify-integrasjon håndterer:

- OAuth-installering og callback.
- Lagring av butikk og access token.
- GraphQL-produktvariantimport.
- Aktive produkter, variantinformasjon, beholdningssnapshot og collections.
- Manuell synk for admin.
- Daglig cron klokken 02:00.
- Cursor, lease, pause, resume, failure og completion.
- Avstemming av produkter som ikke lenger er aktive.

Se [`lib/shopify/sync-products.ts`](../lib/shopify/sync-products.ts), [`lib/shopify/sync-engine.ts`](../lib/shopify/sync-engine.ts) og [`vercel.json`](../vercel.json).

Dagens Shopify-integrasjon håndterer ikke:

- Orders.
- Order webhooks.
- Fulfillment orders.
- Cancellations/refunds.
- Shipping lines.
- Customer/address.
- Fulfillment creation.
- Trackingnummer.
- Lageroppdatering fra Snake til Shopify.
- Webhook-idempotens.
- Integrasjons-outbox/retry for ordrestatus.

Ordreimport bør bygges separat fra den nattlige produktsynken. Ordre må normalt mottas hendelsesdrevet, med periodisk reconciliation som sikkerhetsnett.

## PostNord

Ingen PostNord-kode, datamodell, miljøvariabel eller dokumentert integrasjon finnes.

PostNord bør ligge bak en transportadapter og først kobles på etter at:

- ordre og plukk er stabile,
- pakke/forsendelsesmodellen finnes,
- vekt/dimensjon og mottakerdata er definert,
- etikettlagring og retry er avklart.

## Andre integrasjoner

- OpenAI brukes av Børre og Arne.
- Vercel Cron driver Shopify-synken.
- Ingen annen ordre-, transport-, ERP- eller økonomiintegrasjon ble funnet.

---

# 10. Styrker

- Produktvarianter har stabile Shopify-ID-er og unik SKU når SKU finnes.
- Fysisk beholdning er modellert per lokasjon.
- Lagerendringer er atomiske og bruker radlås.
- Negativ beholdning avvises.
- Samtidighetskontroll finnes ved antallsendring og telling.
- `stock_movements` og `activity_log` gir et godt revisjonsfundament.
- Shopify-synken er cursorbasert, resumable og single-worker.
- Manglende SKU, lokasjon, sone og beholdningsdifferanser er allerede synlige.
- RLS og API-autorisasjon er vesentlig bedre enn et rent klientbasert system.
- UI-et har allerede mange av komponentene en håndholdt plukkflyt trenger.
- Snake Intelligence kan brukes til å overvåke modenhet og drift.

---

# 11. Svakheter og risikoanalyse

## Kritiske modellgap

1. Ingen ordre eller ordrelinjer.
2. Ingen reservasjon.
3. Ingen tilgjengelig-beholdningsberegning.
4. Ingen plukktilstandsmaskin.
5. Ingen persisterte plukkavvik.
6. Ingen fulfillment/forsendelse.
7. Ingen idempotent ordreimport.

Disse må løses før en sikker produksjonsplukkflyt finnes.

## Datakonsistens

- UI-et bruker noen steder første inventory-rad, andre steder sum av alle lokasjoner.
- `is_primary` finnes, men plukkprioritet er ikke definert.
- `inventory.zone_id` kan avvike fra `locations.zone_id`; databasefunksjonene forsøker å holde dem sammen, men modellen har to kilder til sannhet.
- Shopify quantity og lokal quantity er parallelle tall uten definert eierskap.
- SKU kan være `NULL`, mens en ordrelinje trenger deterministisk matching.
- Endring av SKU kan påvirke senere matching hvis Shopify variant-ID mangler.

## Samtidighet

Atomisk lageruttak løser ikke reservasjon. Uten reservasjoner vil samtidige ordre konkurrere om samme fysiske beholdning først ved fullføring.

Et Viper-fundament trenger:

- atomisk allokering,
- unik aktiv reservasjon per ordrelinje/lokasjon eller eksplisitt splitt,
- versjonering eller statusguard,
- idempotente plukkoperasjoner,
- transaksjonell fullføring.

## Ytelse

- Store klientkomponenter henter relativt brede datasett direkte fra Supabase.
- Produkt- og issue-sidene gjør mye aggregering i klienten.
- Ordrekø kan ikke følge samme mønster når volumet øker.
- Aktivitetsloggen har bare en enkel siste-100-visning.
- Shopify products-synken har tidligere nådd Vercels tidsgrense; dokumentasjonen oppgir 1 231 produkter og mer enn 2 400 sekvensielle kall før redesign.
- Viper trenger server-side paginering, målrettede køspørringer og gode status-/assignment-indekser.

## Sikkerhet

- To roller er for grove for ordrearbeid.
- Brede service-role-ruter øker konsekvensen av manglende autorisasjon.
- Produktlesing kontrollerer ikke aktiv profil i RLS.
- Direkte klientspørringer gir større flate for utilsiktet dataeksponering.
- Kundedata vil være mer sensitivt enn dagens lagerdata og bør leveres gjennom minimale DTO-er.
- Ordretilgang må autoriseres per ressurs/oppdrag, ikke bare per rolle.
- Shopify-tokenet ligger i en offentlig-schema-tabell, riktignok beskyttet av RLS og brukt via service role. Hemmeligheter bør vurderes flyttet til et mer eksplisitt privat secret-oppsett.

## Uklare ansvarsområder

- Hva er autoritativ beholdning: Shopify eller Snake?
- Når trekkes fysisk lager: ved plukk av linje, fullført plukk eller fulfillment?
- Skal Viper reservere ved import, ved «klar», eller ved plukkstart?
- Hvordan håndteres ordre som endres i Shopify etter reservasjon?
- Er pakking del av Viper eller en senere modul?
- Hvem kan godkjenne kortplukk og erstatningsvare?
- Skal én ordre kunne deles mellom flere plukkere?
- Skal én plukker kunne plukke flere ordre i batch?

Disse beslutningene bør tas eksplisitt i fase 0/1.

---

# 12. Anbefalt arkitektur

## Hovedprinsipp

Viper bør være et eget domene innen Snake OS, men ikke et separat system.

```text
Viper
├── Ingest
│   ├── Shopify order events
│   ├── reconciliation
│   └── idempotency
├── Orders
│   ├── order header
│   ├── immutable line snapshots
│   └── readiness
├── Inventory allocation
│   ├── reservations
│   ├── availability
│   └── release/reallocation
├── Picking
│   ├── jobs
│   ├── tasks/lines
│   ├── assignment
│   └── event history
├── Exceptions
│   ├── short pick
│   ├── missing/damaged item
│   └── resolution
├── Completion
│   ├── atomic stock deduction
│   ├── shipment
│   └── integration outbox
└── Operations
    ├── queue dashboard
    ├── metrics
    ├── activity
    └── Snake Intelligence
```

## Foreslått tilstandsmaskin

```text
RECEIVED
   │ valider produkt, adresse og mengde
   ▼
BLOCKED ───────────────┐
   │ løst              │ lager/SKU/adresse-feil
   ▼                   │
READY_FOR_ALLOCATION   │
   │                   │
   ▼                   │
RESERVED               │
   │ claim/tildeling   │
   ▼                   │
PICKING ──► EXCEPTION ─┘
   │ alle linjer bekreftet
   ▼
PICKED
   │ transaksjonell ferdigstillelse
   ▼
COMPLETED
   │
   ├──► FULFILLMENT_PENDING
   ├──► FULFILLED
   └──► CANCELLED
```

Statusoverganger må valideres på server/database. UI-et skal ikke kunne sette en vilkårlig status direkte.

## Foreslåtte domeneobjekter

### `orders`

Ordrehode med:

- intern ID
- kilde
- ekstern Shopify-ID
- ordrenummer
- status
- betalings-/fulfillment-snapshot
- prioritet
- kundens leveringsdata
- shipping method
- mottatt/oppdatert/fullført-tid
- ekstern versjon/updated_at
- importfeil og blokkårsak

### `order_lines`

- ordre-ID
- ekstern linje-ID
- produkt-ID når match finnes
- SKU/navn/variant-snapshot
- bestilt, kansellert og nødvendig antall
- reserverbart/plukkbart antall
- status

### `inventory_reservations`

- ordrelinje
- inventory-/lokasjonsrad
- antall
- status
- opprettet/utløper/frigitt
- idempotensnøkkel

Tilgjengelig antall bør beregnes sentralt, helst via databasefunksjon eller sikker view:

```text
available = inventory.quantity − aktive reservasjoner
```

### `pick_jobs`

- ordre eller batch/wave
- status
- tildelt bruker
- claim/start/complete-tid
- versjon
- prioritet

### `pick_tasks`

- pick job
- ordrelinje
- inventory/lokasjon
- forventet antall
- plukket antall
- sekvens
- status

### `pick_events`

Append-only hendelser:

- claimed
- started
- location_scanned
- product_scanned
- quantity_confirmed
- exception_reported
- resumed
- completed

### `pick_exceptions`

- type
- alvorlighetsgrad
- ordre/linje/task
- meldt av
- notat/bilde ved senere behov
- status
- løsning
- løst av/tid

### `shipments` og outbox

Forsendelse bør skilles fra plukk. En transaksjonell outbox bør representere arbeid som skal sendes til Shopify/PostNord, slik at eksterne feil ikke ruller tilbake ferdig fysisk plukk.

## Dataflyt

1. Shopify webhook mottas og verifiseres.
2. Event-ID lagres idempotent.
3. Ordre og linjesnapshots upsertes.
4. Produkter matches primært på Shopify variant-ID, sekundært på SKU.
5. Readiness-regler markerer ordre som blokkert eller allokerbar.
6. En transaksjon reserverer tilgjengelig lager per lokasjon.
7. Viper oppretter plukkoppdrag med optimalisert, men deterministisk rekkefølge.
8. Plukker claimer oppdrag atomisk.
9. Skanning/kvittering registrerer task-events.
10. Avvik oppretter persistert exception og stopper eller splitter flyten etter regel.
11. Fullføring trekker lager, lukker reservasjoner og markerer oppdraget plukket i én transaksjon.
12. Outbox sender fulfillment/tracking til eksterne systemer med retry.
13. Activity og Intelligence får avledede signaler.

---

# 13. Hva kan gjenbrukes?

## Gjenbruk direkte

- `products` som variantidentitet.
- `zones` og `locations`.
- `inventory` som fysisk beholdning.
- `profiles` og aktiv-status.
- `requireRole`-mønsteret.
- Lazy service-role-klient.
- Shopify OAuth og GraphQL-klient.
- Shopify-syncens lease-/resume-/idempotensmønster.
- Atomiske database-RPC-er og radlåsing.
- `stock_movements`.
- UI-komponenter og responsiv stil.
- Aktivitetsvisningens grunnstruktur.
- Snake Intelligence-rammeverket.

## Gjenbruk med utvidelse

- `activity_log`: nye entity types, correlation ID og Viper-filtre.
- `stock_movements`: ordre-, ordrelinje- og plukkref samt nye årsaker.
- Roller/RLS: kapabiliteter og ressursbasert tilgang.
- Issues UI: separer beregnede datakvalitetsproblemer fra persisterte plukkavvik.
- Lokasjoner: plukksekvens og lokasjonstype.
- Dashboard: reell køstatus i stedet for døde lenker.

## Bør bygges nytt

- Ordreingest.
- Ordredomene.
- Reservasjonsmotor.
- Plukktilstandsmaskin.
- Claim/tildeling.
- Plukk-UI.
- Plukkavvik og løsning.
- Shopify fulfillment.
- Forsendelse/PostNord.
- Viper-operasjonelle målinger.

---

# 14. Foreslåtte utviklingsfaser

## Fase 0 – Beslutninger og kontrakter

- Avklar autoritativ beholdning.
- Definer statusmaskin og overgangsregler.
- Definer når reservasjon og fysisk trekk skjer.
- Definer partial/cancellation/edit-regler.
- Definer roller og kapabiliteter.
- Fastsett Shopify-order- og fulfillment-kontrakter.
- Definer MVP-grensen mot pakking/PostNord.
- Etabler målbare akseptansekriterier.

**Leveranse:** domenespesifikasjon, statusdiagram, tilgangsmatrise og integrasjonskontrakter.

## Fase 1 – Ordregrunnlag og ingest

- Ordre-, ordrelinje- og webhook-eventmodeller.
- SKU/variantmatching og snapshots.
- Idempotent Shopify-order-import.
- Webhook + periodisk reconciliation.
- Blokkeringsårsaker.
- RLS, API-DTO-er, revisjon og testdata.

**Leveranse:** pålitelig intern ordrekatalog uten plukk.

## Fase 2 – Tilgjengelig beholdning og reservasjon

- Reservasjonsmodell.
- Atomisk allokering og frigivelse.
- Beregnet tilgjengelig antall.
- Håndtering av flere lokasjoner.
- Reallokering ved endret/kansellert ordre.
- Samtidighets- og belastningstester.

**Leveranse:** ordre kan bli deterministisk `RESERVED` eller `BLOCKED`.

## Fase 3 – Ordrekø og arbeidsledelse

- Viper køside.
- Filter, prioritet, alder og blokkårsak.
- Claim/tildeling.
- Plukkjobb og task-generering.
- Operasjonell oversikt for arbeidsleder.
- Fjern eller erstatt de døde dashboardlenkene.

**Leveranse:** komplett kø fra mottatt ordre til tildelt plukk.

## Fase 4 – Plukkflyt

- Mobilførst plukkvisning.
- Lokasjons- og produktskanning.
- Ett tydelig neste steg.
- Progressiv lagring av task-events.
- Pause/resume.
- Samtidighetskontroll og reassignment.
- Tilgjengelighets- og ergonomitesting på faktisk lagerutstyr.

**Leveranse:** ordre kan plukkes fra start til `PICKED`.

## Fase 5 – Avvik

- Kortplukk, manglende vare, feil vare, skadet vare og lokasjonsfeil.
- Persistert avvikslivssyklus.
- Roller for godkjenning/løsning.
- Reallokering, delvis plukk og kansellering.
- Kobling til dagens datakvalitetsavvik uten å blande modellene.

**Leveranse:** ingen plukk må løses gjennom uloggede manuelle snarveier.

## Fase 6 – Ferdigstillelse og Shopify fulfillment

- Atomisk lagerføring ved ferdigstillelse.
- Lukking av reservasjoner.
- Fulfillment-outbox.
- Retry, dead-letter og operasjonell feilvisning.
- Shopify fulfillment og trackingstatus.
- Fullt aktivitets- og revisjonsspor.

**Leveranse:** ordre går sikkert fra `PICKED` til fullført Shopify-ordre.

## Fase 7 – Forsendelse og PostNord

- Shipment/package-modell.
- Fraktprodukt, vekt/dimensjon og etikett.
- PostNord-adapter.
- Retry og reprint.
- Tracking tilbake til Shopify.
- Avgrensning mellom plukk og pakking.

**Leveranse:** komplett ordre-til-forsendelse-flyt dersom dette fortsatt tilhører Viper.

## Fase 8 – Stabilisering og skalering

- E2E-testing av hele arbeidsflyten.
- Race-condition- og idempotensscenarier.
- RLS-/IDOR-testmatrise.
- Shopify webhook replay.
- Offline/ustabilt nett på lageret.
- Ytelsesmålinger og køindekser.
- Observability, varsling og driftsprosedyrer.
- Kontrollert feature rollout.

**Leveranse:** målbar og operasjonelt trygg produksjonssetting.

---

# 15. Anbefalt vei videre

Den riktige neste aktiviteten er ikke å lage `/viper/page.tsx`. Den er å ferdigstille fase 0 og deretter bygge ordredomenet og reservasjonsmodellen.

Prioritert rekkefølge:

1. Beslutt beholdningseierskap og tidspunkt for lagerføring.
2. Definer ordre- og plukktilstandsmaskinen.
3. Definer Shopify-order/fulfillment-kontraktene.
4. Design ordre-, ordrelinje- og reservasjonstabellene med RLS.
5. Bygg idempotent ordreingest.
6. Bevis reservasjon under samtidighet.
7. Bygg ordrekø.
8. Bygg plukkerens arbeidsflyt.
9. Legg til avvik og fulfillment.
10. Koble på PostNord etter at kjernen er stabil.

Viper har et godt lagerfundament å bygge på, særlig produktidentitet, lokasjoner, atomiske lageroperasjoner og Shopify-syncmønsteret. Men ordredomenet er helt nytt arbeid. Den viktigste arkitekturbeslutningen er derfor å behandle Viper som en sammenhengende, transaksjonell arbeidsflyt—ikke som en ny presentasjon av dagens produktliste.
