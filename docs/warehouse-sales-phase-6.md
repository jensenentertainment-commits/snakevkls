# Lagersalg fase 6: samlet kontrakt- og feilmatrise

Fase 6 introduserer ingen ny produksjonsflyt. Den verifiserer fundamentet fra
fase 1–5 samlet mot en tom, isolert PostgreSQL-database og en stateful
Shopify-fake.

## Verifisert kjede

- lokal fullføring committer salg, linjer, lagertrekk, bevegelser, aktivitet og
  én pending outbox-jobb samlet
- feil før commit etterlater ingen delvise data
- raske og samtidige salg serialiseres på lagerpostene
- parallelle workers claimer forskjellige jobber
- utløpt lease kan overtas, mens gammel worker avvises
- timeout etter faktisk Shopify-justering prøves med identisk payload og samme
  idempotensnøkkel; fake-Shopify anvender deltaet kun én gang
- permanent feil blir synlig uten automatisk retry og kan prøves eksplisitt
- Shopify-nettordre mellom lokal commit og outbound mutation blir ikke skjult
  av lagersalgets delta
- innkommende observasjon før og etter outbound mutation gir riktig
  reconciliation-status

## Reconciliation-status

Matrisen verifiserer:

- `in_sync`
- `outbound_in_flight`
- `outbound_failed`
- `unexplained_difference`

Utgående status kan forklare en forskjell, men kan aldri skrive fysisk lager.
En ekstern Shopify-endring som ikke forklares av outboxen forblir et reelt
avvik.

## Regresjon

Hele Node-testpakken kjøres, inkludert kontraktene for:

- eksisterende `apply_stock_movement` / «Registrer uttak»
- Viper-låsing, plukk og atomisk lagerføring
- eksisterende innkommende Shopify-sync
- dashboard og øvrige lagerfunksjoner

Ingen test bruker produksjonsdata eller en ekte Shopify-token.

## Klarhet for UI

Backendfundamentet er klart for UI-fasen når migrasjonene er kjørt i målmiljøet
og de avtalte utrullingsverdiene er konfigurert. UI-et kan bygge på stabile
kontrakter for produktsøk, atomisk fullføring, salgshistorikk, syncstatus og
forklarte kontra uforklarte avvik.

Før reell bruk gjenstår operasjonell utrulling: migrasjoner, korrekt Shopify
location, reautorisert `write_inventory`, worker-hemmelighet og kontrollert
scheduler. Disse er deploy-oppgaver, ikke mangler i domenekontrakten.
