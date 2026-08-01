# Lagersalg fase 5: samspill mellom Shopify-synkene

`inventory.quantity` er fortsatt autoritativ fysisk beholdning. Innkommende
Shopify-sync lagrer kun en lokasjonsspesifikk observasjon i produktets
`shopify_quantity`, mappingfelter og `shopify_inventory_observed_at`.

## Avviksmodell

Viewet `warehouse_sale_shopify_reconciliation` sammenstiller:

- fysisk Snake-beholdning
- sist observerte Shopify-beholdning ved eksplisitt Snake-lokasjon
- uobserverte negative deltaer fra utgående lagersalg
- status og tidspunkt for outbox-jobbene

Statusene er:

- `observation_unavailable`: mapping eller observasjon mangler
- `in_sync`: rå Shopify-observasjon matcher Snake
- `outbound_in_flight`: forskjellen forklares fullt av pending/processing eller
  en vellykket mutation som er nyere enn observasjonen
- `outbound_failed`: forskjellen forklares, men en utgående jobb står feilet
- `unexplained_difference`: forskjellen kan ikke forklares av outboxen

Dashboardets quantity-diff teller bare `unexplained_difference`. En forventet,
midlertidig forskjell blir dermed ikke presentert som en fysisk lagerfeil.
Feilede utgående jobber forblir synlige som syncfeil, ikke som grunnlag for
automatisk lagerreparasjon.

## Hendelsesrekkefølge

En innkommende observasjon før Shopify-mutasjonen viser normalt gammel, høyere
Shopify-beholdning. Det negative outbox-deltaet forklarer forskjellen.

Etter vellykket mutation regnes deltaet fortsatt som uobservert så lenge siste
Shopify-observasjon er eldre enn `synced_at`. Når en senere innkommende sync
observerer den reduserte verdien, faller deltaet ut av forklaringen og status
blir `in_sync`.

Hvis en senere observasjon fortsatt ikke matcher Snake, og ingen uobservert
operasjon forklarer forskjellen, blir status `unexplained_difference`.

## Etterlesing

Fase 5 utfører ingen obligatorisk målrettet Shopify-etterlesing. En slik
etterlesing kan senere redusere tiden en rad står som `outbound_in_flight`, men
korrekthet og idempotens er ikke avhengig av den. Ordinær innkommende sync er
tilstrekkelig.
