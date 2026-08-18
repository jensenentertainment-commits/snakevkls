# Viper – foreslått arbeidsflyt og implementeringsplan

Dette er et planforslag basert på Viper-kartleggingen. Ingen implementasjon, kode- eller databaseendringer er startet.

## 1. Mål for Viper v1

Viper v1 skal gi én komplett og sporbar arbeidsflyt:

```text
Ordre mottatt
  → validert
  → beholdning kontrollert og reservert
  → klar til plukk
  → plukkoppdrag startet
  → linjer plukket eller avvik registrert
  → plukk fullført
```

Første versjon er ferdig når en lagermedarbeider kan ta en gyldig ordre fra køen, plukke den kontrollert og avslutte plukket uten manuelle omveier.

V1 avsluttes ved «plukk fullført». Pakking, PostNord og fraktbestilling ligger utenfor.

---

# 2. Avgrensning av første versjon

## Inngår i V1

- Ordre og ordrelinjer.
- Shopify som første ordrekilde.
- Idempotent ordreimport.
- Produktmatching med Shopify variant-ID og SKU.
- Validering og blokkering av ufullstendige ordre.
- Kontroll av tilgjengelig beholdning.
- Reservasjon per ordrelinje og lagerlokasjon.
- Ordrekø.
- Plukkoppdrag og plukklinjer.
- Atomisk start/claim av plukk.
- Bekreftelse av plukklinjer.
- Registrering og behandling av grunnleggende avvik.
- Fullføring av plukk.
- Lagerbevegelse ved fullføring.
- Strukturert hendelses- og aktivitetslogg.
- Grunnleggende tilgangsstyring for `admin` og `lager`.
- Manuell retry/rebehandling av blokkerte ordre.

## Inngår ikke i V1

- PostNord.
- Fraktbestilling og etiketter.
- Avansert pakking.
- Batch-/wave-plukk.
- Ruteoptimalisering.
- Erstatningsvarer.
- Deling av ett plukkoppdrag mellom flere plukkere.
- Automatiske handlinger fra Børre.
- Digital Workforce.
- Avansert arbeidslederflate.
- Prediktiv analyse og store rapporteringsfunksjoner.
- Avansert retur- og refusjonsflyt.

## Bevisst forenkling

V1 bruker én ordre per plukkoppdrag.

En ordre kan reserveres fra flere lokasjoner dersom samme produkt finnes flere steder, men én plukklinje peker alltid på én konkret lokasjon.

---

# 3. Konkret arbeidsflyt

## Steg 1 – Ordre mottas

En ordre mottas fra Shopify gjennom en idempotent ingest-operasjon.

Systemet lagrer:

- Shopify order ID.
- Ordrenummer.
- Ekstern oppdateringsversjon/tid.
- Kunde- og leveringssnapshot.
- Betalings- og fulfillment-status.
- Fraktmetode som informasjon.
- Ordrelinjer med ekstern linje-ID.
- SKU, produktnavn og variantnavn som historisk snapshot.
- Bestilt og kansellert antall.

Samme Shopify-hendelse eller ordreversjon skal kunne mottas flere ganger uten å opprette duplikater.

Startstatus:

```text
RECEIVED
```

Hendelser:

- `order_received`
- `order_imported`
- eventuelt `order_import_failed`

## Steg 2 – Ordren valideres

For hver aktiv ordrelinje forsøker Viper å finne produkt:

1. Shopify variant-ID.
2. SKU som sekundær match.
3. Ingen automatisk fuzzy matching.

Ordren blokkeres dersom:

- En relevant ordrelinje ikke kan matches.
- SKU eller variantidentitet er tvetydig.
- Bestilt antall er ugyldig.
- Ordren er kansellert eller ikke plukkbar.
- Nødvendige ordredata mangler.

Gyldig ordre går videre til beholdningskontroll.

Statuser:

```text
RECEIVED → VALIDATING
VALIDATING → BLOCKED
VALIDATING → ALLOCATING
```

En blokkert ordre skal ha en maskinlesbar årsak, for eksempel:

- `PRODUCT_NOT_FOUND`
- `AMBIGUOUS_PRODUCT`
- `INVALID_QUANTITY`
- `ORDER_CANCELLED`
- `ORDER_DATA_INCOMPLETE`

## Steg 3 – Tilgjengelig beholdning kontrolleres

Viper skiller mellom tre mengder:

```text
fysisk beholdning = inventory.quantity
reservert beholdning = aktive reservasjoner
tilgjengelig beholdning = fysisk − reservert
```

Tilgjengelig beholdning beregnes per `inventory`-rad og dermed per lokasjon.

Allokeringen:

1. Leser aktuelle lagerlinjer i en deterministisk rekkefølge.
2. Låser relevante rader.
3. Trekker fra eksisterende aktive reservasjoner.
4. Oppretter reservasjoner for hele ordrebehovet i samme transaksjon.
5. Oppretter ingenting dersom hele ordren ikke kan reserveres.

V1 anbefales å bruke «alt eller ingenting» på ordrenivå. Det gir en enklere og tryggere kø:

- Hele ordren reserveres og blir klar.
- Eller ordren blokkeres på grunn av manglende beholdning.

Status:

```text
ALLOCATING → RESERVED
ALLOCATING → BLOCKED
```

Blokkårsak:

```text
INSUFFICIENT_STOCK
```

Hendelser:

- `allocation_started`
- `inventory_reserved`
- `allocation_failed`
- `reservation_released`

## Steg 4 – Ordren blir klar til plukk

Når alle nødvendige ordrelinjer er fullstendig reservert:

- Ordren får status `READY_TO_PICK`.
- Ett plukkoppdrag opprettes.
- Reservasjonene materialiseres som konkrete plukklinjer.
- Plukklinjene peker på ordrelinje, produkt, inventory-rad og lokasjon.
- Linjene sorteres deterministisk etter lagret plukksekvens eller, i V1, lokasjonskode.

```text
RESERVED → READY_TO_PICK
```

Ordrekøen viser nå ordren som tilgjengelig arbeid.

## Steg 5 – Plukker starter oppdraget

Lagermedarbeideren åpner ordrekøen og velger en ordre.

Startoperasjonen må være atomisk:

- Kontroller at oppdraget fortsatt er `READY`.
- Kontroller at ordren fortsatt kan plukkes.
- Sett plukkoppdraget til `IN_PROGRESS`.
- Lagre plukkeren.
- Lagre starttidspunkt.
- Hindre at en annen bruker starter samme oppdrag.

```text
READY_TO_PICK → PICKING
pick_job: READY → IN_PROGRESS
```

V1 kan bruke «første bruker som starter får oppdraget». Admin kan senere frigjøre et fastlåst oppdrag.

Hendelser:

- `pick_job_claimed`
- `pick_started`

## Steg 6 – Plukk pågår

Plukkeren får én konkret arbeidsliste:

- Ordrenummer.
- Fremdrift.
- Nåværende lokasjon.
- Produktbilde.
- SKU.
- Produkt- og variantnavn.
- Forventet antall.
- Allerede bekreftet antall.
- Tydelig neste handling.

Anbefalt bekreftelse i V1:

1. Plukkeren åpner linjen.
2. SKU skannes eller bekreftes.
3. Antall bekreftes.
4. Linjen markeres som fullført.

Lokasjonsskanning kan støttes, men behøver ikke være obligatorisk i første iterasjon dersom lagerets etiketter og utstyr ikke er ferdig avklart.

Plukklinjens statuser:

```text
PENDING → IN_PROGRESS → PICKED
PENDING/IN_PROGRESS → EXCEPTION
```

Hendelser:

- `pick_line_started`
- `product_confirmed`
- `pick_quantity_confirmed`
- `pick_line_completed`

## Steg 7 – Avvik registreres

V1 støtter minst:

- `ITEM_NOT_FOUND`
- `INSUFFICIENT_AT_LOCATION`
- `WRONG_ITEM_AT_LOCATION`
- `DAMAGED_ITEM`
- `LOCATION_PROBLEM`
- `OTHER`

Et avvik inneholder:

- ordre
- ordrelinje
- plukkoppdrag
- plukklinje
- type
- forventet og observert antall
- fritekstnotat
- hvem som registrerte
- tidspunkt
- status og løsning

Ved avvik:

- Plukklinjen blir `EXCEPTION`.
- Plukkoppdraget blir `BLOCKED`.
- Ordren blir `PICK_EXCEPTION`.
- Reservasjonen beholdes inntil avviket løses eller eksplisitt frigjøres.

V1 bør ikke automatisk velge erstatningsvare.

Grunnleggende løsninger:

- `RETRY_SAME_LOCATION`
- `REALLOCATE_LOCATION`
- `ACCEPT_SHORT_PICK`
- `CANCEL_LINE`
- `CANCEL_ORDER`

`ACCEPT_SHORT_PICK` og kansellering bør være adminhandlinger i V1.

Hendelser:

- `pick_exception_reported`
- `pick_exception_resolved`
- `pick_reallocated`
- `short_pick_accepted`

## Steg 8 – Plukk fullføres

Fullføring er én transaksjon og tillates bare når:

- Oppdraget er `IN_PROGRESS`.
- Alle plukklinjer er `PICKED`, eller avvik er eksplisitt løst.
- Oppdraget eies av innlogget bruker eller fullføres av admin.
- Reservasjonene fortsatt er gyldige.
- Fysisk beholdning fortsatt dekker plukket mengde.

Transaksjonen:

1. Låser plukkoppdrag, plukklinjer, reservasjoner og berørte inventory-rader.
2. Kontrollerer forventet status og mengde.
3. Reduserer `inventory.quantity`.
4. Oppretter `stock_movements` med Viper-referanser.
5. Marker reservasjoner som konsumert.
6. Marker plukkoppdrag som `COMPLETED`.
7. Marker ordre som `PICKED`.
8. Oppretter strukturerte domenebegivenheter og aktivitet.

```text
PICKING → PICKED
pick_job: IN_PROGRESS → COMPLETED
```

V1 slutter her. Shopify fulfillment og forsendelse skjer ikke automatisk.

---

# 4. Foreslått statusmodell

## Ordrestatus

```text
RECEIVED
VALIDATING
ALLOCATING
BLOCKED
RESERVED
READY_TO_PICK
PICKING
PICK_EXCEPTION
PICKED
CANCELLED
```

`BLOCKED` bør kombineres med `blocked_reason`, ikke brukes alene som forklaring.

## Plukkoppdrag

```text
READY
IN_PROGRESS
BLOCKED
COMPLETED
CANCELLED
```

## Plukklinje

```text
PENDING
IN_PROGRESS
PICKED
EXCEPTION
CANCELLED
```

## Reservasjon

```text
ACTIVE
CONSUMED
RELEASED
EXPIRED
```

## Avvik

```text
OPEN
IN_REVIEW
RESOLVED
CANCELLED
```

Statusfeltene bør bruke database-constraints og eksplisitte overgangsfunksjoner. Klienten skal aldri få utføre en generell `UPDATE status = ...`.

---

# 5. Teknisk domene- og datamodell

## Nye kjernetabeller

| Tabell | Ansvar |
|---|---|
| `orders` | Ordrehode og overordnet arbeidsflytstatus |
| `order_lines` | Historiske ordrelinjesnapshots og produktkobling |
| `order_ingest_events` | Webhook-idempotens og importstatus |
| `inventory_reservations` | Reservert antall per ordrelinje og inventory-rad |
| `pick_jobs` | Ett plukkoppdrag per ordre i V1 |
| `pick_lines` | Konkret produkt, lokasjon og mengde som skal plukkes |
| `pick_exceptions` | Persisterte avvik og løsning |
| `viper_events` | Strukturert append-only domenelogg |

Eksisterende `activity_log` beholdes som menneskeorientert operasjonslogg. `viper_events` blir maskinorientert og stabil nok for senere digitale ansatte.

## Viktige identitetsregler

- Unik Shopify order ID per kilde.
- Unik ekstern ordrelinje-ID innen ordre.
- Unik webhook/event-ID per kilde.
- Maks ett aktivt V1-plukkoppdrag per ordre.
- En aktiv reservasjon må peke på én ordrelinje og én inventory-rad.
- Plukklinjens produkt og lokasjon skal komme fra reservasjonen.
- Alle domenetabeller bruker interne UUID-er.

## Historiske snapshots

Ordrelinjen må beholde:

- SKU ved bestilling.
- Produktnavn ved bestilling.
- Variantnavn ved bestilling.
- Shopify variant-ID.
- Bestilt mengde.

Plukk- og ordrehistorikk må ikke være avhengig av at dagens `products`-rad fortsatt har samme navn eller SKU.

---

# 6. Strukturert hendelseslogging

`viper_events` bør minst inneholde:

- `id`
- `event_type`
- `occurred_at`
- `order_id`
- `order_line_id`
- `pick_job_id`
- `pick_line_id`
- `exception_id`
- `actor_id`
- `actor_type`
- `correlation_id`
- `causation_id`
- `source`
- `schema_version`
- `payload jsonb`

Eksempel på hendelseskjede:

```text
order_received
  → order_validated
  → inventory_reserved
  → pick_job_created
  → pick_started
  → pick_line_completed
  → pick_completed
```

Prinsipper:

- Append-only.
- Ingen hemmeligheter i payload.
- Ingen full kundeadresse dersom hendelsen ikke trenger det.
- Stabilt `event_type`.
- Versjonert payload.
- Hendelsen skrives i samme transaksjon som tilstandsendringen.
- `activity_log` kan få en lesbar oppsummering av samme handling.
- Børre skal senere lese sikre visninger eller DTO-er, ikke rå kundedata eller skrive direkte i Viper.

Dette gir fremtidig lesbarhet uten å starte assistentarkitektur nå.

---

# 7. Tjeneste- og API-arkitektur

## Foreslått modulstruktur

```text
lib/viper/
├── orders/
│   ├── types
│   ├── validation
│   ├── repository
│   └── service
├── allocation/
│   ├── availability
│   ├── reservation
│   └── service
├── picking/
│   ├── types
│   ├── transitions
│   ├── repository
│   └── service
├── exceptions/
├── events/
└── shopify/
    ├── order-mapper
    └── ingest
```

UI og Route Handlers skal være tynne. Forretningsregler skal ligge i server-only domenetjenester og transaksjonelle databasefunksjoner der samtidighet krever det.

## Foreslåtte API-flater

```text
POST /api/viper/shopify/orders
GET  /api/viper/orders
GET  /api/viper/orders/:id
POST /api/viper/orders/:id/retry-allocation

GET  /api/viper/picks
POST /api/viper/picks/:id/start
POST /api/viper/picks/:id/lines/:lineId/confirm
POST /api/viper/picks/:id/exceptions
POST /api/viper/picks/:id/complete
POST /api/viper/exceptions/:id/resolve
```

Shopify webhook-ruten må bruke Shopify HMAC-verifisering, ikke brukerrolle.

Alle brukerinitierte ruter må:

- verifisere sesjon,
- kontrollere aktiv profil,
- kontrollere rolle og ressurs,
- validere input,
- returnere minimale DTO-er,
- være idempotente der dobbel innsending er sannsynlig.

## Server Actions

Det er ikke nødvendig å introdusere Server Actions i V1. Eksisterende Route Handler-mønster kan beholdes for å få én tydelig API-grense og enklere testing.

---

# 8. UI for Viper v1

## Ordrekø `/viper`

Køen bør ha fire praktiske visninger:

- Klar til plukk.
- Mine aktive plukk.
- Blokkert/avvik.
- Fullført i dag.

Hver kølinje viser:

- ordrenummer
- mottatt-tid og alder
- antall linjer/enheter
- status
- blokkårsak
- eventuell plukker
- tydelig neste handling

## Ordredetalj `/viper/orders/[id]`

Viser:

- ordrestatus og tidslinje
- ordrelinjer
- produktmatching
- reservasjoner og lokasjoner
- plukkoppdrag
- avvik
- hendelseslogg
- adminhandlinger når relevante

## Plukkflate `/viper/picks/[id]`

Mobilførst:

- stor lokasjonskode
- produktbilde, SKU og variant
- forventet antall
- progresjon
- bekreftelseshandling
- «Registrer avvik»
- minimal navigasjon bort fra oppdraget

Plukkeren skal ikke måtte tolke Shopify quantity, lagerhelse eller generelle produktavvik mens et oppdrag utføres.

---

# 9. Tilgang i V1

For å holde første versjon liten kan eksisterende roller brukes slik:

| Handling | `admin` | `lager` |
|---|---:|---:|
| Se ordrekø | Ja | Ja |
| Starte ledig plukk | Ja | Ja |
| Fortsette eget plukk | Ja | Ja |
| Registrere avvik | Ja | Ja |
| Fullføre eget plukk | Ja | Ja |
| Se alle aktive oppdrag | Ja | Begrenset |
| Frigi/omfordele oppdrag | Ja | Nei |
| Retry allokering | Ja | Nei |
| Godta kortplukk | Ja | Nei |
| Kansellere ordre/linje | Ja | Nei |

En senere arbeidslederrolle kan legges til når behovet er konkret. Ressursautorisasjon må likevel bygges fra start.

---

# 10. Små, godkjennbare byggefaser

## Fase V0 – Arbeidsflyt og kontrakter

Ingen produksjonskode.

Leveranser:

- Godkjent V1-scope.
- Godkjent statusmaskin.
- Beslutning om reservasjon.
- Beslutning om lagerføringstidspunkt.
- Avvikstyper og løsninger.
- Tilgangsmatrise.
- Shopify order-felter og webhook-temaer.
- Akseptansekriterier.

Godkjenningspunkt: Viper-arbeidsflyten er entydig.

## Fase V1 – Datamodellutkast

Ingen aktiv ordreimport eller UI.

Leveranser:

- Konkret skjema for kjernetabellene.
- Constraints og indekser.
- RLS-matrise.
- Hendelsesskjema.
- Plan for utvidelse av `stock_movements` og `activity_log`.
- Migrasjons- og rollback-plan.
- Testscenarier for samtidighet.

Godkjenningspunkt: Datamodellen kan støtte hele V1 uten åpne kritiske gap.

## Fase V2 – Ordreingest

Leveranser:

- Idempotent Shopify ordreimport.
- Ordre- og ordrelinjesnapshots.
- Produktmatching.
- Validering og blokkårsaker.
- Enkel intern ordredetalj for kontroll.
- Integrasjonstester og replay-tester.

Godkjenningspunkt: Samme ordre kan importeres og oppdateres gjentatte ganger uten duplikater eller tap.

## Fase V3 – Reservasjon og tilgjengelig beholdning

Leveranser:

- Sentral tilgjengelighetsberegning.
- Atomisk allokering.
- Reservasjon og frigivelse.
- Konkurrerende ordre-test.
- Reallokering ved admin-retry.
- Synlig reservasjon på ordredetaljen.

Godkjenningspunkt: To ordre kan ikke reservere samme tilgjengelige enhet.

## Fase V4 – Ordrekø og plukkoppdrag

Leveranser:

- `/viper`.
- Kø for klar, blokkert og aktiv.
- Opprettelse av plukkoppdrag/-linjer.
- Atomisk claim/start.
- Mine aktive oppdrag.
- Grunnleggende admin-frigivelse.

Godkjenningspunkt: Én ordre kan gå fra import til startet plukk.

## Fase V5 – Linjeplukk

Leveranser:

- Mobilførst plukkflate.
- Produktbekreftelse.
- Antallsbekreftelse.
- Fremdrift og resume.
- Idempotent linjebekreftelse.
- Hendelseslogging.

Godkjenningspunkt: Alle linjer kan bekreftes kontrollert uten lagerføring ennå.

## Fase V6 – Avvik

Leveranser:

- Registrering av V1-avvik.
- Blokkering av oppdrag.
- Adminløsninger.
- Reallokering.
- Full avvikshistorikk.

Godkjenningspunkt: En manglende eller skadet vare kan håndteres uten manuelle databaseendringer.

## Fase V7 – Fullføring

Leveranser:

- Transaksjonell plukkfullføring.
- Beholdningstrekk.
- `stock_movements`.
- Konsumering av reservasjoner.
- Ordre-/oppdragsstatus `PICKED`/`COMPLETED`.
- Aktivitet og domenebegivenheter.
- Samtidighets- og retry-tester.

Godkjenningspunkt: En ordre kan gå komplett fra mottatt til ferdig plukket én gang og bare én gang.

## Fase V8 – Stabilisering

Leveranser:

- E2E-test av hovedflyt og avvik.
- RLS- og IDOR-testing.
- Webhook replay.
- Dobbelklikk/dobbel innsending.
- Brutt nett og resume.
- Køpaginering og indekskontroll.
- Operasjonelle dashboards for import- og plukkfeil.
- Kontrollert aktivering.

Godkjenningspunkt: Viper v1 er produksjonsklar.

---

# 11. Beslutninger som må godkjennes før implementasjon

Planen anbefaler følgende:

1. V1 slutter når plukket er fullført; ingen PostNord eller automatisk Shopify fulfillment.
2. Én ordre gir ett plukkoppdrag.
3. Hele ordren må kunne reserveres før den blir klar til plukk.
4. Reservasjon skjer per konkret inventory-rad/lokasjon.
5. Fysisk lager trekkes først ved fullført plukk.
6. Et avvik blokkerer plukkoppdraget til det er løst.
7. `lager` kan plukke og registrere avvik; admin løser kortplukk, kansellering og omfordeling.
8. Structured `viper_events` bygges fra start, men ingen assistent får automatiske handlinger.
9. Route Handlers og server-only domenetjenester beholdes som applikasjonsmønster.
10. Shopify ordrewebhooks suppleres senere med reconciliation, men nattlig produktsynk brukes ikke som ordrekanal.

Implementasjon skal ikke starte før disse punktene og fase V0 er godkjent.
