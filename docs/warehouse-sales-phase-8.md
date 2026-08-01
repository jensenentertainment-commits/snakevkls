# Lagersalg fase 8

## Implementert

- Autentisert produktsøk mot `products` og fysisk `inventory`.
- Søk på produktnavn, variantnavn og SKU.
- Serverbasert requote med Shopify-standardpris, prisoverstyring,
  fysisk beholdning, linjesummer og totalsum.
- Fullføring gjennom `complete_warehouse_sale` etter fersk requote.
- Stabil klientoperasjonsnøkkel som beholdes ved ukjent resultat.
- Beskyttelse mot parallelle fullføringskall i klienten.
- Ekte salgshistorikk og internt, uforanderlig salgsbilag.
- Vipps vises som betalingsmåte; Shopify-sync blokkerer ikke lokal suksess.
- Fixtures og minnebasert salgslagring er fjernet.

## Målmiljø per 29. juli 2026

- Supabase-prosjekt: `vk-lager` (`gcjvaeqjkrrrzrdccrrv`).
- Shopify-forbindelsen har `write_inventory`, men mangler `read_locations`.
- Shopify returnerer én lokasjons-ID, men navn og aktiv status kan ikke
  valideres uten `read_locations`.
- `shopify_connections.inventory_location_id` er derfor ikke konfigurert.
- Produktene har ennå ikke fase 1-feltene for pris og lokasjon fylt ut.
- Ingen ekte fullføring er kjørt mot målmiljøet.

## Før produksjonspilot

1. Reautoriser Shopify-forbindelsen med minst `read_products`,
   `read_inventory`, `write_inventory`, `read_locations` og `read_orders`.
2. Valider og registrer den eksplisitte Shopify-lokasjonen som representerer
   Snake-lageret.
3. Kjør innkommende Shopify-sync og kontroller pris, inventory item og
   lokasjon på et avgrenset testprodukt.
4. Sett kontrollert fysisk beholdning på testproduktet.
5. Kjør ett kontrollert lagersalg og verifiser salg, linje, lagertrekk,
   lagerbevegelse, aktivitet og én pending Shopify-jobb.
6. Verifiser replay med samme operasjonsnøkkel og avvisning etter
   beholdningsendring.
7. Konfigurer worker-scheduler og `WAREHOUSE_SALES_WORKER_SECRET`.
8. Kjør en eksplisitt godkjent Shopify smoke-test og kontroller at samme
   delta ikke anvendes mer enn én gang.
