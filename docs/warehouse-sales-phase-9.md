# Lagersalg fase 9: produksjonsklargjøring

## Worker og pilotdrift

- Manuell og kontrollert kjøring bruker
  `POST /api/internal/warehouse-sales/shopify-worker` med
  `WAREHOUSE_SALES_WORKER_SECRET`.
- Vercel Hobby har ingen automatisk Lagersalg-worker.
- Administratorer ser antall salg som venter på Shopify og antall som krever
  oppfølging i salgshistorikken.
- Administratorer kan behandle neste ventende jobb manuelt. Hvert kall
  claimer maksimalt én jobb gjennom den samme lease- og worker-kontrakten.
- Automatisk scheduler vurderes senere som ekstern scheduler eller Vercel Pro.

## Operativ feil og korrigering

1. Stopp manuelle worker-kall mens feilen undersøkes.
2. Ikke reverser `warehouse_sales`, `warehouse_sale_lines`,
   `stock_movements`, `activity_log` eller `inventory.quantity`.
3. Les jobbstatus, `attempt_count`, feilkode, payload, location-ID,
   idempotensnøkkel og Shopify-observasjonen.
4. Ved timeout eller ukjent resultat: bruk samme jobb og samme
   idempotensnøkkel. Opprett aldri en ny negativ Shopify-justering manuelt.
5. Ved permanent feil: rett scope, location eller inventory item, og bruk den
   eksplisitte retry-kontrakten. Endre aldri den lagrede payloaden.
6. Ved dokumentert feiljustering i Shopify: stans manuelle kall, avstem Snake mot
   fysisk lager og Shopify, og gjennomfør en separat, dokumentert positiv
   Shopify-korreksjon. Det opprinnelige salget og lagerbevegelsen beholdes.
7. Kjør innkommende produktsync etter korrigering og bekreft
   reconciliation-status før manuell behandling fortsetter.

## Smoke-test

Smoke-testen skal bare behandle den godkjente pending jobben for
`LS-2026-00000001`. Forventet Shopify-delta er `-1` for SKU `63084` ved
lokasjonen `Ryghgata 2`. Ingen ny jobb eller ny operasjonsidentitet skal
opprettes.

Shopify Admin API 2026-04 krever at `changeFromQuantity` oppgis eksplisitt.
Worker sender `null` for dette feltet fordi Snake-operasjonen er et
idempotent delta, ikke en absolutt beholdningssetting. Dette gjør at en
nettordre mellom lokal commit og worker ikke gjør det lagrede deltaet ugyldig.

## Verifisert smoke-test 29. juli 2026

- Jobb `d051be92-ccff-4513-a9bd-bab252e1f395` brukte samme payload,
  location-ID og Shopify-idempotensnøkkel gjennom begge forsøkene.
- Første forsøk avdekket det nye 2026-04-kravet om eksplisitt
  `changeFromQuantity` og endret ikke Shopify-beholdningen.
- Kontrollert retry med `changeFromQuantity: null` ble claimet med aktiv lease
  og `attempt_count=2`, og endte som `synced`.
- Shopify-beholdning for SKU `63084` gikk fra 9 til 8. Snake forble 8.
- Neste worker-kjøring returnerte `idle`; Shopify forble 8.
- Innkommende produktsync observerte 8, og målproduktet fikk
  reconciliation-status `in_sync`.
- Salgshistorikk, internt bilag og dashboardets serverdata ble lest korrekt.
- Dashboardet rapporterte 843 øvrige `unexplained_difference`. Dette er
  eksisterende datagrunnlagsavvik utenfor smoke-produktet og bør behandles som
  et eget operativt oppryddingspunkt.
