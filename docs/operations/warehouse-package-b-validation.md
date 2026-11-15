# Pakke B – varig lokasjonstelling

Lokal kandidat, validert 15.11.2026. Valideringsresultatene nedenfor gjelder den lokale kontrollen før separat godkjent utrulling.
Den separate tekstrettingen i `app/products/page.tsx` består kun av fire strenger; ingen endret filtrering eller beregning.

## Omfang

- `app/location-count/page.tsx`: beholdt lokasjonssøk, tospaltet arbeidsflate, telt antall og notater. Henter lagret økt når lokasjonen åpnes. Viser lagret/ulagret fremdrift, sperrer fullføring ved ulagrede endringer og krever omlasting etter feil. Alle aktive lokasjoner hentes paginert. Ingen klientberegnede summer sendes ved fullføring.
- `lib/inventory/count-session.ts`: typer, validering av kommandoer og lagret/ulagret tilstand.
- `lib/inventory/count-handler.ts`: felles autentisert serveradapter; aktør hentes fra innlogget bruker. Uendrede roller: admin, user, warehouse. Ingen brukeroppgitt aktør eller forventet beholdning brukes.
- `app/api/location-count/session/route.ts`: les/start/gjenoppta og uttrykkelig ny telling.
- Eksisterende linje- og fullføringsruter kaller den nye økt-RPC-en. Gamle payloads uten session-ID og versjon avvises.

## Én ny forward-migrasjon

`supabase/migrations/20261115153609_durable_location_count_sessions.sql`

SHA-256: `9A0C4EF2D2AF21F1B5A8EF7B3A67BCBFD4CDA763EA7268F51F1FBF287FB3F776`.

- To nye tabeller: `location_count_sessions` og `location_count_session_lines`.
- Unik partiell indeks tillater én aktiv økt per lokasjon. Økten er felles for autoriserte lagerbrukere; den er ikke bundet til én nettleser eller innlogging. Versjonskontroll hindrer stille overskriving mellom brukere/faner.
- Historiske `location_counts` beholdes, med nullable `session_id`; gamle rader tilordnes ikke nye økter. Ny linjelagring bruker eksisterende tellehistorikk og aktivitet, uten stock movements.
- `inventory.count_revision` og en BEFORE-trigger skifter revisjon ved endret lageridentitet, produkt, lokasjon, sone eller antall. Dette oppdager blant annet 10→9→10 og flytting ut/tilbake. Urelaterte oppdateringer kan ikke overstyre revisjonen. Ingen antall eller plasseringer endres av migrasjonen eller telle-RPC-en.
- Lesefunksjon `get_location_count_session_v1` og kommandofunksjon `manage_location_count_v1`. Begge SECURITY INVOKER, tom search_path, kun service_role EXECUTE. Nye tabeller har RLS og ingen direkte anon/authenticated-rettigheter; autorisasjon utføres av eksisterende requireRole før service-kall.
- Fullføring beregner serverens antall lagrede, samsvarende og forskjellige linjer, og lagrer ett resultat/én hendelse. Gjentatt fullføringsforespørsel med samme førversjon returnerer lagret resultat.
- En avgrenset trigger på `location_count_completed` krever en fullført tellesession. Dermed kan eldre deploymenters gamle completion-rute ikke fortsette å logge udokumenterte fullføringer. Gammel `record_location_count` beholdes for historisk kompatibilitet; slike enkeltregistreringer kan ikke fullføre nye økter.

## Samtidighet og gjenopptakelse

Kommandoer låser økt → lokasjon FOR UPDATE NOWAIT → inventory-rader i UUID-rekkefølge FOR UPDATE NOWAIT. Deretter leses hele postsettet på nytt med et nytt READ COMMITTED-snapshot. Inventory-FK hindrer nye poster/flytting inn; radlåsene beskytter eksisterende poster. Andre lokasjoner kan brukes. Ingen generell inventory-tabellås eller endring i Viper-RPC-er.

Låsekonflikter avviser transaksjonen. Klienten må laste inn lagret økt; det er ingen automatisk retry eller ombasering. Endret grunnlag krever uttrykkelig «Start ny telling». Den gamle økten merkes abandoned, med lagrede linjer/historikk bevart. Å lukke fanen endrer ikke aktiv status. Fullførte økter kan leses, men ikke redigeres gjennom RPC-en.

## Faktisk validering

- **449 lokale tester bestått, 0 feil**, inkludert 10 nye tellekontrakt-/adaptertester.
- **23 SQL-kontroller + rollback-kontroll bestått**: nullbeholdning, SKU-løse varer, lagret fremdrift, versjonskonflikt, feil lokasjon, uferdige linjer, serverberegnede summer, idempotens, ABA, nytt grunnlag, historikk, én aktiv økt og faktiske databaseprivilegier.
- **15 samtidighets-/etterkontroller bestått**, med tre forbindelser (to aktører og en lesende kontroll av `pg_blocking_pids`): samtidig start/lagring/fullføring, innsetting, flytting inn/ut, antallsendring, sletting, tom lokasjon, annen lokasjon, nytt committet postsett, replay og uendret beholdning.
- Testmål: kun `snake_phase2a_test_catalogfresh`, 127.0.0.1:55433, PostgreSQL 17.11, system-ID `7705827962930311860`, bruker `snake_catalog_test`, eksisterende datakatalog. Identitetsguard kjøres på alle forbindelser; ingen .env eller fjernmål støttes.
- Rollback-testen installerer hele migrasjonen i en transaksjon og ruller tilbake. Samtidighetstesten installerer kandidaten midlertidig i det lokale testmålet, bruker et UUID-manifest, og fjerner kun kandidatens objekter og egne syntetiske rader etter bestått test. Før-/ettertilstand er identisk. Ingen database nullstilt.
- Første rollback-test avdekket en tvetydig lokal SQL-variabel `count_id`; rettet til `saved_count_id`. Opprinnelig feilbevis er bevart, og den rettede migrasjonen bestod begge testtypene.
- TypeScript og produksjonsbygg bestått. Lint: **0 feil, 22 eksisterende advarsler**. Målrettet lint av de nye tellefilene uten advarsler. Diffkontroll bestått.
- Nettlesertest av faktisk telleside mot en **syntetisk, filbasert testadapter**: utfylt≠lagret, fremdrift 0/2→1/2→2/2, null lagret eksplisitt, andre utkast beholdt ved linjelagring, omlasting/gjenåpning, endret notat sperrer fullføring, fullføring låser feltene, ny telling og to faner med foreldet versjon. Desktop og 390×844 mobil uten horisontal overflyt.

Bevis under `coverage/warehouse-package-b/` (ikke leveranseinnhold):

- `rollback-bbd7ae5d-96aa-4cc4-b037-507c15ef4c2d/`
- `concurrency-5178d50e-cdf2-43ed-abcf-ebd1234f37a3/`
- `unit-tests.txt`, `lint.txt`, `build.txt`

Kjørere: `scripts/warehouse-package-b-test.mjs --rollback-test` og `scripts/warehouse-package-b-concurrency.mjs --run`. Forhåndsvisning: `node scripts/warehouse-package-b-preview.mjs`, localhost:3045. Forhåndsvisningen laster ingen produksjonskonfigurasjon og skal ikke inngå i produksjonsleveransen.

## Begrensninger og separat utrulling

- Ingen ny ekte innlogging eller ende-til-ende RLS-nettlesertest mot kandidatens database er utført. Serveradapteren er eksekvert i isolerte autorisasjonstester; databaseprivilegier er testet med faktiske lokale roller. Ny innlogging skal hente samme lagrede økt, men er ikke presentert som manuelt verifisert.
- Mobiltest er viewport-test, ikke fysisk skjermtastatur.
- Telling dokumenterer de registrerte lagerpostene på valgt lokasjon. Den oppretter ikke varer som finnes fysisk, men mangler i lagerregisteret. Fysisk flytting under telling må unngås operativt; en databaselås ved fullføring reserverer ikke varer under selve opptellingen.
- Ved utrulling: fersk identitets-/avhengighetskontroll, bekreftet backup, kort stopp av telleoperasjoner, migrasjon én gang, samsvarende app og innlogget røykprøve uten reelle lagerjusteringer. Kontroller ledger og gamle completion-kall før gjenåpning. Ikke rull app alene tilbake til gammel telleflyt mot ny guard.
- Kontroller at eksisterende fullføringshendelser ikke allerede har kolliderende `sessionId` før unik indeks opprettes. Migrasjonen skal stoppe ved slike avvik, ikke fjerne historikk.
- Ingen produksjonsmigrasjon, commit/push/deploy eller Cron-aktivering er utført. Viper- og Shopify-kode er urørt.

## Godkjent produksjonsutrulling 15.11.2026

- Brukeren bekreftet Cron deaktivert og Snake-faner lukket. Ingen aktive klienttransaksjoner, synk-/plukkjobber eller uferdige Lagersalg-jobber ble funnet før migrasjonen.
- Dagens verifiserte Pakke A-dump og krypterte USB-kopi ble kontrollert på nytt med samme SHA-256 som verifikasjonsmanifestet. Ingen ny backup ble tatt. Den dokumenterte restore-generalprøven og dagens selektive restore-test er bevart. Full restore fra denne dumpen krever også gjeninnføring av den bevarte Pakke A-migrasjonen; ingen automatisk restore eller nedmigrasjon utføres.
- Riktig produksjon: `gcjvaeqjkrrrzrdccrrv`, system-ID `7626352619084395911`. Ingen negativ beholdning eller kolliderende completion-session-ID-er. Validert, aktiv inventory/location-FK.
- Kun kandidatens migrasjon kjørt. Fire installerte funksjonskropper sammenlignet eksakt mot filen, alle identiske. SECURITY INVOKER, RLS og ingen authenticated EXECUTE bekreftet.
- Verktøyet registrerte automatisk ledger-versjon `20261115171551`. Etter definisjonskontroll ble kun denne oppføringen avstemt til filversjon `20261115153609`, uten ny SQL-kjøring.
- Inventory, eksisterende location_counts og activity_log samsvarer med førverdier når nye metadatafelter utelates fra sammenligningen. 29 lagerposter, sum 0; eksisterende historikk bevart.
- Ny sluttkjøring: 449 tester bestått. Applikasjonsdeploy og innlogget røykprøve følger denne commiten. Skriveprøven skal bare dokumentere en tydelig merket teknisk telling, aldri endre beholdning eller fremstilles som fysisk opptelling.
