# Lagersalg fase 1: Shopify-kataloggrunnlag

## Omfang

Fasen legger til standardpris fra Shopify og knytter Snake-lageret til én
eksplisitt Shopify-lokasjon. Den innkommende synken observerer `available` ved
denne lokasjonen. Den skriver aldri til `inventory.quantity`.

Det er ikke opprettet salgstabeller, utgående inventory-mutasjoner eller UI i
denne fasen.

## Shopify-forutsetninger

OAuth-tilkoblingen trenger:

- `read_products`
- `read_inventory`
- `write_inventory`
- `read_orders`

En eksisterende tilkobling må reautoriseres etter at `write_inventory` er lagt
til. Faktisk innvilgede scopes lagres fortsatt på `shopify_connections`.

Shopify-butikken må bruke NOK som butikkvaluta for Lagersalg V1.

## Location mapping

Etter at migrasjonen er kjørt, må den Shopify-lokasjonen som representerer
Snake-lageret registreres på butikkforbindelsen:

```sql
update public.shopify_connections
set inventory_location_id = 'gid://shopify/Location/SHOPIFY_ID',
    inventory_location_name = 'Navnet i Shopify',
    inventory_location_configured_at = now(),
    updated_at = now()
where shop = 'butikk.myshopify.com';
```

Synken stopper med en tydelig feil hvis mappingen mangler, lokasjonen ikke
finnes eller lokasjonen er inaktiv. Ingen eksisterende katalogdata endres når
sidehentingen feiler før database-RPC-en.

## Lagrede observasjoner

`products` får:

- `shopify_price_minor`
- `shopify_price_currency`
- `shopify_inventory_tracked`
- `shopify_inventory_level_id`
- `shopify_inventory_location_id`
- `shopify_inventory_observed_at`

Eksisterende `shopify_quantity` representerer etter en fullført ny sync
`available` ved den konfigurerte Shopify-lokasjonen. `NULL` betyr at produktet
ikke har et aktivt inventory level ved lokasjonen; `0` betyr at inventory
level finnes med null tilgjengelig.

Historiske produktverdier blir ikke backfill-et av migrasjonen. Pris og
lokasjonsspesifikk Shopify-beholdning fylles ved første komplette sync etter
konfigurasjon.

## Utrullingsrekkefølge

1. Kjør fase 1-migrasjonen.
2. Registrer og kontroller Shopify location-ID og navn.
3. Sett `SHOPIFY_SCOPES` til å inkludere `write_inventory`.
4. Reautoriser Shopify-forbindelsen.
5. Kjør en manuell innkommende sync.
6. Kontroller pris, valuta, inventory level og observert `available`.
7. Bekreft at `inventory.quantity` er uendret.
