# Fase 3: lagertransaksjoner og dataintegritet

## Avgrensning

Fasen endrer bare lageroperasjoner, lagertelling og tilhørende aktivitetslogg.
Auth, RLS, Shopify-sync, Børre/Arne, SPM og øvrige moduler er ikke endret.

## Problemene som er rettet

- Produktsiden skrev `quantity` til `stock_movements`; faktisk kolonne er
  `quantity_delta`.
- Inventory, movement og activity ble skrevet i separate forespørsler. Feil i
  en sen forespørsel kunne etterlate en delvis oppdatert beholdning.
- Read-modify-write kunne miste samtidige oppdateringer.
- `set-location` leste beholdning, men satte aldri `previousQuantity`.
- Location count logget en vellykket telling i feilgrenen og ikke etter suksess.
- Batch-plassering kunne stoppe etter at bare noen produkter var oppdatert.
- To reason-constraints var motstridende; den ene avviste `receiving`.
- `activity_log` avviste `entity_type = 'user'`, selv om profilruten bruker den.

## Atomiske databasefunksjoner

Migrasjonen oppretter service-role-only, `SECURITY INVOKER`-funksjoner:

- `apply_stock_movement(uuid, integer, text, text, integer, uuid, text, text)`
- `set_product_location(uuid, uuid, uuid, uuid, integer, uuid, text, text)`
- `add_product_to_location(uuid, uuid, integer, uuid, text, text)`
- `remove_product_from_location(uuid, uuid, text, text)`
- `batch_set_product_zone(uuid[], uuid, uuid, text, text)`
- `record_location_count(uuid, uuid, integer, integer, text, uuid, text, text)`

Funksjonene låser berørte inventory-rader med `FOR UPDATE`. Inventory,
stock movement og activity opprettes i samme PostgreSQL-transaksjon. En feil i
constraint, movement eller activity ruller derfor tilbake hele operasjonen.

`apply_stock_movement` støtter en forventet gammel beholdning. Ruten som setter
et absolutt antall bruker dette som optimistisk samtidighetskontroll. Vanlige
delta-operasjoner beregner ny beholdning under radlåsen. Et delta som ville gitt
negativ beholdning avvises eksplisitt; inventory, movement og activity rulles da
tilbake som én transaksjon.

Batch-plassering behandler produkt-ID-er i stabil sorteringsrekkefølge og er én
RPC/transaksjon. Ingen delmengde blir stående oppdatert ved feil.

## Constraints og eksisterende data

- `stock_movements_reason_valid` fjernes. Den eksisterende
  `stock_movements_reason_check` beholdes og tillater `manual_sale`, `waste`,
  `internal_use`, `correction`, `receiving` og `other`.
- `activity_log_entity_type_check` erstattes med samme verdier pluss `user`.
- `location_counts.difference` beholdes som generert kolonne:
  `counted_quantity - expected_quantity`.

Ingen eksisterende produkt-, inventory-, movement- eller count-rader endres.
Produksjonskontrollen før implementasjon viste 29 inventory-rader, én movement,
én telling, ingen negativ beholdning, ingen feil difference og ingen dupliserte
produkt/lokasjon-par.

## API-ruter

Følgende ruter bruker nå RPC-ene:

- `/api/inventory/stock-movement`
- `/api/inventory/set-location`
- `/api/inventory/batch-zone`
- `/api/locations/add-product`
- `/api/locations/update-quantity`
- `/api/locations/remove-product`
- `/api/location-count`

Produktsiden bruker de eksisterende autoriserte API-rutene og skriver ikke
lenger inventory eller movements direkte fra nettleseren.

`/api/location-count/complete` har bare én databasewrite. Den sjekker nå
activity-feilen og returnerer ikke suksess dersom loggen feiler.

## Testmatrise

På en lokal Supabase-instans eller isolert databasebranch:

1. Kjør migrasjonen og kontroller at alle seks funksjoner finnes og bare
   `service_role` har execute.
2. Kall `apply_stock_movement` med gyldig delta. Inventory, movement og activity
   skal alle finnes, med korrekt `previousQuantity` og ny beholdning.
3. Kall `apply_stock_movement` med et uttak større enn beholdningen. Kallet skal
   avvises, uten endring i inventory, movement eller activity.
4. Fremprovoser activity-feil i en transaksjon. Inventory og movement skal være
   uendret etter feilen.
5. Start to samtidige movements mot samme inventory-rad. Begge deltaer skal
   serialiseres uten tapt oppdatering, eller expected-quantity-kallet skal få
   en eksplisitt konflikt.
6. Kall `record_location_count` med forventet 10 og telt 7. Lagret `difference`
   og activity-metadata skal begge være `-3`.
7. Kall count med stale expected quantity. Verken count eller success-activity
   skal opprettes.
8. Kall batch med én ugyldig produkt-ID. Ingen av produktene skal få ny sone.
9. Oppdater profil og bekreft at `entity_type = 'user'` kan lagres.

Lokalt kjørt i dette arbeidsmiljøet:

- TypeScript `tsc --noEmit`: bestått.
- Målrettet ESLint for alle endrede API-ruter: bestått.
- Migrasjonen parses som 21 gyldige PostgreSQL-statements med `pglast`.
- Produktsidens eksisterende lintgjeld (`any` og funksjonsrekkefølge) er fortsatt
  rapportert og ikke ryddet, siden generell UI-opprydding er utenfor fase 3.
- `git diff --check`: kjøres før levering.
- Migrasjonen er kjørt mot en isolert lokal PostgreSQL 17.10-database med bare
  syntetiske data. Vanlig lagerbevegelse, avvisning av negativ beholdning,
  rollback ved activity-feil, samtidige writes mot samme inventory-rad, atomisk
  batch og generert `location_counts.difference` er dynamisk verifisert.

## Migrasjon og utrulling

Migrasjon:

- `supabase/migrations/20260721172143_phase_3_inventory_integrity.sql`

Appkoden kaller de nye RPC-ene. Migrasjonen må derfor være tilgjengelig før den
nye appversjonen aktiveres. Ingen produksjonsmigrasjon eller deploy inngår i
denne fasen.
