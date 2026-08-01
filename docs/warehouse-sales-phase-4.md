# Lagersalg fase 4: utgående Shopify-worker

Fase 4 behandler én transactional-outbox-job om gangen. Workerens eneste
lageroperasjon er Shopifys `inventoryAdjustQuantities` med negative deltaer.
Snake-salget og `inventory.quantity` endres aldri av workerens resultat.

## Claim og lease

`claim_warehouse_sale_shopify_sync_job` velger neste klare jobb med
`FOR UPDATE SKIP LOCKED` og setter status til `processing` i samme transaksjon.
Hvert claim får et nytt lease-token og øker `attempt_count`.

En annen worker kan ikke behandle samme jobb mens leasen lever. En utløpt
`processing`-jobb kan overtas med nytt token. Complete og fail krever nøyaktig
jobb-ID, token og en lease som fortsatt lever. Et gammelt worker-resultat kan
derfor ikke overskrive resultatet fra en nyere worker.

## Uforanderlig Shopify-operasjon

Worker bruker feltene som ble lagret sammen med salget:

- `payload`
- `payload_hash`
- `shopify_location_id`
- `idempotency_key`
- `reference_document_uri`

Claim, retry og statusoverganger oppdaterer aldri disse feltene. Den samme
idempotensnøkkelen sendes med `@idempotent` på alle Shopify-forsøk.

## Feilklassifisering

- `unknown`: timeout, nettverksbrudd eller manglende/uleselig bekreftelse.
  Resultatet kan allerede være utført hos Shopify og prøves derfor igjen med
  samme idempotensnøkkel.
- `transient`: rate limit, 5xx, service unavailable og andre eksplisitt
  midlertidige Shopify-feil. Automatisk retry bruker begrenset eksponentiell
  backoff.
- `permanent`: ugyldig location, inventory item, scope, tilgang eller payload.
  Feilen blir stående uten automatisk retry, men kan eksplisitt settes klar
  igjen gjennom retry-RPC-en.

Worker reverserer aldri lokalt lager eller ferdige salg ved noen feiltype.

## Utløsning

`POST /api/internal/warehouse-sales/shopify-worker` er et internt,
hemmelighetsbeskyttet endepunkt. Det krever
`WAREHOUSE_SALES_WORKER_SECRET` som Bearer-token. Fase 4 etablerer ikke UI.

## Test

Shopify-testene bruker en injisert fake `fetch` og kontrollerer eksakt mutation,
delta, location, referanse og idempotensnøkkel. Ingen test kan kontakte eller
endre ekte Shopify.

Databasemigrasjonen verifiseres dynamisk mot isolert PostgreSQL med claim,
parallell blokkering, timeout-feil, planlagt retry, eksplisitt retry, nytt
lease-token, avvisning av gammel lease og uforanderlig operasjonsidentitet.
