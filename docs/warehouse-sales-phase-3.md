# Lagersalg fase 3: atomisk lokal fullføring

Fase 3 etablerer én autoritativ lokal fullføringskontrakt for lagersalg. Kontrakten oppretter salget, trekker fysisk lager og oppretter den utgående Shopify-jobben i samme PostgreSQL-transaksjon. Den gjør ingen eksterne kall.

## Inngang

Applikasjonen kaller `public.complete_warehouse_sale` med:

- en klientgenerert og stabil idempotensnøkkel
- en SHA-256-hash av den normaliserte forespørselen
- betalingsmåte (`vipps` i V1)
- produktlinjer med produkt-ID, antall og faktisk enhetspris i hele øre
- butikk og verifisert aktørinformasjon

Linjer normaliseres i applikasjonen ved å sorteres på produkt-ID. Duplikate produkter avvises; klienten skal samle antall på én linje før fullføring.

RPC-en er kun tilgjengelig for `service_role`. Aktør-ID og rolle hentes fra den autentiserte Snake-brukeren og valideres på nytt i databasen.

## Transaksjon og låser

Funksjonskallet er én PostgreSQL-statement og deltar i én transaksjon. Det finnes ingen eksplisitt `COMMIT`, feilbehandler eller kompensasjonslogikk i funksjonen. En feil ruller derfor tilbake alle lokale endringer.

Låserekkefølgen er:

1. transaksjonslås på idempotensnøkkelen med `pg_advisory_xact_lock`
2. eventuelt eksisterende salg med samme nøkkel `FOR UPDATE`
3. alle berørte produkter `FOR UPDATE`, sortert på produkt-ID
4. alle berørte fysiske lagerposter `FOR UPDATE`, sortert på lagerpost-ID

Tilgjengelig fysisk beholdning kontrolleres etter at lagerpostene er låst og før første domeneinnsetting. Alle produkter valideres samlet, slik at delvis fullføring ikke kan skje.

Lager trekkes fra primærlokasjon først, deretter deterministisk på opprettelsestidspunkt og ID. Dette endrer ikke kontrakten til eksisterende «Registrer uttak».

## Atomisk resultat

Et vellykket førstegangskall oppretter samlet:

- ett fullført salg med salgsnummer
- uforanderlige salgslinjer med produkt-, pris- og Shopify-snapshot
- nøyaktige reduksjoner i `inventory.quantity`
- lagerbevegelser knyttet til salget og salgslinjen
- én aktivitetsoppføring
- nøyaktig én `pending` Shopify-syncjobb med uforanderlig negativ delta-payload

Standardpris og faktisk salgspris lagres separat. Totalsummen beregnes i databasen fra faktisk enhetspris og antall.

## Idempotens

Idempotensnøkkelen identifiserer ett lokalt fullføringsforsøk. Advisory-låsen serialiserer samtidige kall med samme nøkkel før noen domenedata skrives.

- Samme nøkkel, aktør og request-hash returnerer det allerede fullførte salget som en replay.
- Samme nøkkel med endret innhold eller annen aktør avvises som idempotenskonflikt.
- Replay oppretter ikke nye salgslinjer, lagerbevegelser, aktiviteter eller Shopify-jobber og trekker ikke lager på nytt.

Den utgående jobben får i tillegg en stabil Shopify-idempotensnøkkel og en kontrollsum for den lagrede payloaden. Fase 4 bruker disse ved retry.

## Rollback

Følgende avviser hele operasjonen uten delvise lokale endringer:

- ugyldig eller tom salgskurv
- ugyldig bruker eller rolle
- ukjent, inaktivt eller ikke-salgbart produkt
- manglende pris-, inventory item- eller location-mapping
- manglende Shopify-forbindelse eller `write_inventory`
- utilstrekkelig fysisk beholdning på én eller flere linjer
- konflikt på idempotensnøkkel
- feil ved opprettelse av salg, linjer, lagerbevegelser, aktivitet eller outbox-jobb

Det gjøres ingen Shopify-mutasjon i transaksjonen og ingen automatisk reversering utenfor den.

## HTTP-kontrakt

`POST /api/warehouse-sales/complete`:

- krever rollen `admin` eller `lager`
- validerer og normaliserer forespørselen
- beregner request-hash
- delegerer hele mutasjonen til RPC-en
- returnerer `201` ved ny fullføring og `200` ved idempotent replay

Endepunktet skriver ikke direkte til domenetabeller og kaller ikke Shopify.

## Verifikasjon og utrulling

Fase 3 har statiske kontrakttester for transaksjonsgrensen, låserekkefølgen, idempotens, lagerallokering, rollback og fravær av Shopify-kall. Migrasjonen er SQL- og PL/pgSQL-parset.

Migrasjonene er i tillegg kjørt fra tom database mot en isolert PostgreSQL
17-instans. Verifikasjonen bruker kun syntetiske data og en falsk Shopify-token;
ingen testkode utfører nettverkskall. Følgende er dynamisk verifisert:

- flerlinjesalg og primær-først-allokering over flere lagerposter
- korrekt salg, linjer, lagerbevegelser, aktivitet og én pending outbox-jobb
- idempotent replay og konflikt ved endret request-hash
- full rollback ved utilstrekkelig beholdning
- full rollback ved en injisert feil under opprettelse av lagerbevegelser
- to parallelle kall med samme idempotensnøkkel
- to parallelle salg som konkurrerer om samme utilstrekkelige beholdning
- parallelle flerlinjesalg med motsatt inputrekkefølge uten deadlock

Den første dynamiske kjøringen avdekket tvetydige PL/pgSQL-navn i
fullføringsfunksjonen. Eksisterende migrasjon ble ikke endret. Korrigeringen
ligger i en ny migrasjon som erstatter funksjonen med entydige variabelnavn.

Testene kan gjentas med SQL-filene under `tests/database`. En isolert
Supabase-instans bør fortsatt brukes som siste utrullingskontroll for å
verifisere samme migrasjonsrekke mot Supabases eksakte PostgreSQL-image og
plattformroller.
