# Pakke A – avgrenset sluttkontroll 15.11.2026

Ingen produksjonsskriving, migrasjon, commit, push eller deploy er utført. Pakke B er bare en låseprototype. Denne kontrollen endrer kun lokalt testverktøy og dokumentasjon.

## Testresultat

`node scripts/warehouse-concurrency-test.mjs --run` bestod med 18 kontroller: 7 for A, 10 for B og én før-/etterkontroll av eksisterende testdatabasetilstand. Flere av A-kontrollene er reelle tosesjonstester; registrering/antallsendring over flere poster kontrolleres også sekvensielt. En tredje, lesende sesjon bekrefter ventende låser med `pg_blocking_pids`, fremfor å anta samtidighet ut fra tidsforsinkelser.

Mål: kun `snake_phase2a_test_catalogfresh`, 127.0.0.1:55433, PostgreSQL 17.11, system-ID `7705827962930311860`, bruker `snake_catalog_test`, eksisterende godkjent datakatalog. Eksisterende SQL-guard kjøres på hver forbindelse. Ingen miljøfiler lastes og ingen fjernadresse kan velges.

Kandidatens funksjonskropp kjøres uendret, men funksjonen opprettes i hver forbindelses `pg_temp` for å unngå permanent installasjon. Syntetiske fixtures må committes for synlighet mellom sesjoner. UUID-manifest lagres først; bare kjøringens egne rader fjernes etter beståtte tester. Ved feil beholdes bevis og committede fixtures, og åpne transaksjoner rulles tilbake. Ingen database nullstilles.

Bevis: `coverage/warehouse-package-a/concurrency-543bf9e6-2e10-4206-912b-a374539e9c15/` med manifest, før-/etterverdier og resultater. Tidligere kjøring er bevart. En første kjøreroppstart ble stoppet før fixtureopprettelse fordi Windows CRLF ikke ble gjenkjent; kun testkjørerens resultatavlesing ble korrigert.

### Pakke A

- Eksisterende `apply_stock_movement` endrer 10 → 7 og holder låsen. Ny plassering venter, flytter deretter og bevarer 7; produktets andre lagerpost beholder 4.
- Plassering holder låsen først. `apply_stock_movement` venter og endrer deretter antallet korrekt til 8.
- To flyttinger med samme forventede førplassering: første lykkes, andre avvises med 40001. Ingen overskriving.
- Samtidig lagerhendelse gjør eksplisitt antallsendring foreldet: 40001 og nyere antall beholdes.
- Eksplisitt antallsendring retter bare valgt inventory-UUID ved flere poster. Førstegangsregistrering av et produkt som allerede har poster avvises.
- Samtidige førstegangsregistreringer gir én post; den andre avvises med 40001.
- Eksisterende `add_product_to_location` kan legge varen på en annen lokasjon etter førstegangsregistrering. Senere eksplisitt antallsendring bevarer den andre posten.

Den ordinære dialogens eksisterende valg av første lagerpost er ikke utvidet til en ny flerpostvelger. Serveren bruker den eksplisitte inventory-UUID-en, og flytting inn på en allerede opptatt produkt/lokasjon-kombinasjon avvises uten sammenslåing.

I tillegg bestod `warehouse-package-a-test.mjs --rollback-test`: 18 SQL-kontroller av den faktiske migrasjonen, inkludert tilbakekalte rettigheter, sperret gammel RPC også for eier, replay og rollback. Hele migrasjonen rulles tilbake etter testen. Etterkontrollen bekrefter gammel funksjonsdefinisjon, lager/hendelsestall og fravær av ny permanent RPC.

15 målrettede lokale kontrakt-/UI-regresjoner bestod. Node-syntakskontroll, lint av ny kjører og diffkontroll bestod. Ingen produksjonskode er endret siden forrige beståtte TypeScript, produksjonsbygg og brede 439-testkjøring; disse er ikke gjentatt uten ny kodeendring.

## Produksjon – bare lesing

Bekreftet `gcjvaeqjkrrrzrdccrrv`, database/bruker postgres, PostgreSQL 17.6, system-ID `7626352619084395911`. Forespørslene kjøres med `BEGIN READ ONLY`.

| RPC | Identitetsargumenttyper |
|---|---|
| set_product_location | uuid,uuid,uuid,uuid,integer,uuid,text,text |
| apply_stock_movement | uuid,integer,text,text,integer,uuid,text,text |
| add_product_to_location | uuid,uuid,integer,uuid,text,text |
| remove_product_from_location | uuid,uuid,text,text |
| record_location_count | uuid,uuid,integer,integer,text,uuid,text,text |

Alle fem: eier postgres, SECURITY INVOKER, tom search_path, EXECUTE for postgres/service_role, ingen EXECUTE for anon/authenticated. Den nye RPC-en finnes ikke; kandidatens ledger-versjon finnes ikke. Den historiske `20260721172143_phase_3_inventory_integrity` er registrert.

Produksjonens gamle RPC-definisjon har MD5 `ecc67f5414f1226c41b7678b4baefd6b`, identisk med funksjonen i den lokale testdatabasen. Ingen registrerte pg_depend-avhengigheter eller andre databasefunksjoner med referanse til navnet ble funnet. PL/pgSQL/dynamisk SQL og eksterne integrasjoner kan ikke fullstendig bevises fraværende med pg_depend alene; repo-søk er derfor også gjennomført.

Repo før endring: eneste RPC-kaller er `/api/inventory/set-location`; klienter er produktlisten, produktdetaljer og Ryddemodus. De to ordinære produktflatene er allerede flyttet lokalt til ny API. Add/remove/movement/count-RPC-er endres ikke. Den gamle skip-ruten skriver bare en historikkhendelse; den nye versjonen svarer 410 uten databasekall.

## Gamle klienter og deployments

Vercel viste 13 READY-produksjonsdeployments, 11 unike commits. Nyeste er `dpl_HGYCbuKXfVuRZ1fAGfHq9z9kkhAN`, commit `1ddd3626d589ecd442f1c6e88a9073dcc015d993`. For alle 11 commits er gammel placement-API kontrollert: den kaller `set_product_location`, uten direkte inventory-skriving i ruten.

Migrasjonen erstatter gammel RPC med ubetinget avvisning og tilbakekaller service_role-kjøring. Dette sperrer den kjente usikre beholdningsskrivingen også fra gamle deployment-URL-er. Ny app returnerer 410 for begge pensjonerte HTTP-ruter. Gamle faner må laste på nytt; ingen automatisk retry eller tilbakeføring til usikker RPC.

Dette er ikke en generell tilbakekalling av alle inventory-rettigheter. Eldre deployments er fortsatt registrert, og gamle skip-ruter kan fortsatt logge historikk dersom URL-ene beholdes. Minste ekstra sperre ved utrulling er prosjektomfattende Deny av `/api/inventory/set-location` og `/api/fix-locations/skip`, uten hostname-begrensning, også på alternative deployment-URL-er. Ny plassering bruker en annen URL. Aktivering/dekning må godkjennes og verifiseres ved utrulling; ingen regler er endret nå. Alternativet er separat godkjent sperring/sletting av gamle deployments.

## Anbefalt utrullingsrekkefølge – krever ny godkjenning

1. Avgrenset release med allerede testet migrasjon og app. Verifiser kandidat/hash på nytt. Ingen tidlig automatisk deploy ved push.
2. Kort skrivestans på alle hostnavn og direkte appskriveveier, verifiser at aktive operasjoner har sluttet, og ta avtalt fersk backup. Cron forblir avslått.
3. Kjør bare `20261115140231_safe_product_placement_retire_cleanup.sql` transaksjonelt. Verifiser ledger, nye/gamle RPC-rettigheter og uendrede delte RPC-er. SHA-256 på testet lokal fil: `E3A37361D3C87C08CF4D8D22638DCCC3629D75693147171AF10701FFCF8270F9`.
4. Deploy den samsvarende appen mens sperren fortsatt er aktiv. Bekreft READY, riktig commit/alias og nye ruter. Behold sperring av pensjonerte ruter på alle hostnavn, eller håndter gamle deployments separat.
5. Lesebasert og ikke-lagrende kontroll av begge produktflater, tilgang og Avvik. Bekreft at gamle URL-er ikke kan bruke pensjonert flyt. Åpne manuelt og krev reload av gamle faner.

Det finnes et teknisk mellomstadium der gammel app ikke kan lagre plassering mot oppgradert database; dette skal aldri være brukertilgjengelig. Løsningen er et kort vedlikeholdsvindu, ikke påstand om null nedetid. Ved feil holdes systemet stengt. Ikke rull appen alene tilbake eller reaktiver gammel usikker RPC automatisk; korrigering/restore vurderes ut fra faktisk transaksjonsstatus.

## Pakke B – anbefaling etter låseprototypen

Behold forslaget om kort FOR UPDATE NOWAIT på lokasjonen etter session-låsen, deretter inventory-rader i UUID-rekkefølge FOR UPDATE NOWAIT, og separat ferskt READ COMMITTED-oppslag før servervalidert fullføring. Ingen global inventory-tabellås anbefales.

Produksjonens `inventory_location_id_fkey` er validert, ikke utsatt/deferrable, og alle fire tilhørende FK-triggere er aktivert. Eksisterende FK hindrer nye poster/flytting inn mens foreldreraden er låst. Radlåsene hindrer antallsendring, flytting ut og sletting. Dette ble bekreftet med reelle ventende lokale sesjoner, også på tom lokasjon.

Prototypen bekreftet også at annen lokasjon kan skrives, at invers låserekkefølge gir NOWAIT-avvisning fremfor deadlock, at Viper-lignende produkt/locations-SHARE gir trygg konflikt, og at et nytt separat snapshot oppdager en nylig committet lagerpost. Viper selv ble ikke endret eller kjørt.

Forutsetninger: alle relevante skrivinger håndhever FK; ingen superbruker/replication-role-omgåelse; kort lock_timeout/statement_timeout; hele fullføringstransaksjonen avbrytes ved låsekonflikt. Ikke svelg konflikten og fortsett. Session/revisjonskontroll må i senere Pakke B håndtere ulagrede linjer, ABA-endringer, hele postsettet og idempotens. Prototypen beviser låsemekanismen, ikke en ferdig tellesession eller fullførings-RPC. Ingen slike tabeller eller migrasjoner er laget.
