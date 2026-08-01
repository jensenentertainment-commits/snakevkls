# Lagersalg fase 2: salgsdomene og transactional outbox

## Omfang

Fasen etablerer datamodellen for fullførte lagersalg og én utgående
Shopify-operasjon per salg. Den inneholder ingen fullførings-RPC, worker,
Shopify-mutasjon, lagerendring eller UI.

## Tabeller

### `warehouse_sales`

Ett immutable, fullført salg med:

- unikt salgsnummer
- generell betalingsmåte (`vipps` brukes i V1)
- valuta og summer i hele øre
- totalt antall og linjeantall
- fullføringstidspunkt og aktørsnapshot
- lokal idempotensnøkkel
- hash av den autoritative fullføringsforespørselen

Salgsnummerformatet er `LS-YYYY-NNNNNNNN`. Sekvenshull er tillatt; nummeret er
identitet og revisjonsspor, ikke en opptelling av vellykkede salg.

### `warehouse_sale_lines`

Immutable snapshots av produkt, SKU, navn, variant, ordinær Shopify-pris,
faktisk enhetspris og antall. Linjesum og markering av prisoverstyring er
genererte databasekolonner.

Samme produkt kan bare forekomme én gang i samme salg.

### `warehouse_sale_shopify_sync_jobs`

Transactional outbox med maksimalt én jobb per salg. Jobben har:

- stabil Shopify-idempotensnøkkel
- uforanderlig payload og payload-hash
- eksplisitt Shopify location-ID
- status `pending`, `processing`, `synced` eller `failed`
- attempts, retrytid og worker-lease
- permanent resultat eller feilmelding

Jobbens identitet og payload kan ikke endres ved retry. Bare
behandlingsstatus og resultatfelter kan oppdateres.

## Lagerkobling

`stock_movements` får referanse til både salg og salgslinje. En
`warehouse_sale`-bevegelse må ha begge referansene, og den sammensatte
fremmednøkkelen sikrer at linjen faktisk tilhører salget.

Eksisterende movement-typer, inkludert `manual_sale` og `viper_pick`, beholdes.
Ingen eksisterende uttaksflyt endres.

## Tilgang

Alle tre tabeller har RLS.

- aktive `admin`- og `lager`-brukere kan lese
- `anon` har ingen tilgang
- `authenticated` har ingen direkte skrivetilgang
- `service_role` brukes av kommende autoriserte serveroperasjoner

Fullførte salg og salgslinjer avviser update og delete også dersom en
privilegert kodevei skulle forsøke det.

## Invariants

Fase 2 håndhever:

- maksimalt én Shopify-jobb per salg
- unik lokal idempotensnøkkel per salg
- unik Shopify-idempotensnøkkel per butikk
- uforanderlig salg, salgslinjer og jobbpayload
- positive antall
- ikke-negative priser og summer
- sammenhengende jobbstatus, lease, resultat og feilfelter
- salgslinjen på en lagerbevegelse tilhører samme salg
- read-only Data API for operative brukere

Fase 3 skal håndheve i én transaksjon:

- minst én salgslinje
- summer i salgshodet matcher linjene
- nøyaktig én pending outboxjobb opprettes sammen med salget
- lagerbevegelser og fysisk lagertrekk matcher salgslinjene
