# Lager – pakke A og låsevurdering for pakke B

Lokal implementering. Ingen produksjonsmigrasjon eller deploy er utført.

Oppdatert sluttkontroll: se [warehouse-package-a-final-validation.md](warehouse-package-a-final-validation.md). Tosesjonstestene og produksjonens lesebaserte RPC/FK-kontroll er nå gjennomført; begrensningene nedenfor beskriver den tidligere implementeringsrunden.

## Avhengigheter kontrollert før endring

- `set_product_location` er definert i `20260721172143_phase_3_inventory_integrity.sql` og kalles bare fra `app/api/inventory/set-location/route.ts` i aktiv applikasjonskode.
- Rutens konsumenter: produktlisten (`useProductsActions.ts`), produktdetaljer (`app/products/[id]/page.tsx`) og Ryddemodus (`app/fix-locations/page.tsx`).
- `add_product_to_location` brukes separat av `/api/locations/add-product`; `remove_product_from_location` av lokasjonsflyten; `apply_stock_movement` av lagerhendelser. Disse skal ikke sperres eller endres.
- Eksisterende inventory-UUID-er refereres av lagerbevegelser, telling og Viper. Ingen rader slettes eller slås sammen i ny plasseringsflyt.
- Det finnes direkte inventory-skriverettigheter gjennom eksisterende RLS. Pensjoneringen gjelder den gamle Ryddemodus-flyten, ikke en generell tilbakekalling av lagerrettigheter.
- Historisk SQL og historiske hendelser beholdes. Den gamle klientkomponenten arkiveres utenfor aktive Next-ruter.

## Pakke A

Ny plassering bruker eksplisitt handling: `place` endrer aldri quantity; `register` oppretter første lagerpost; `quantity` endrer antall bare med forventet antall og endringstidspunkt. Begge eksisterende produktflater bruker samme kontrakt. Eksisterende poster identifiseres med inventory-UUID. Sone avledes fra aktiv lokasjon i SQL. Kollisjon med samme produkt på mållokasjonen avvises, uten sammenslåing.

Den gamle HTTP-ruten og skip-ruten svarer 410 etter eksisterende autorisasjon. Forward-migrasjonen gjør også gammel RPC feilende og tilbakekaller service_role-kjøring. Nye funksjoner får kun service_role-kjøring og SECURITY INVOKER. RLS og eksisterende roller endres ikke.

Ved utrulling kreves kontrollert skrivestans, migrasjon og ny app før gjenåpning. Gamle deployment-URL-er må håndteres separat; gamle klienter må laste siden på nytt. Ikke gjenåpne gammel app mot ny migrasjon. Eksterne RPC-konsumenter må bekreftes fraværende før produksjon. Ingen slik utrulling er godkjent her.

## Pakke B – kun vurdering, anbefalt lås per lokasjon

Eksisterende `inventory_location_id_fkey` peker fra inventory.location_id til locations.id (baseline linje 75). Ingen senere repo-migrasjon endrer eller deaktiverer denne. Fremmednøkkelkontrollen tar KEY SHARE på referert lokasjon ved innsetting eller flytting inn. Dette kan brukes uten å endre alle skrive-RPC-er.

Foreslått fullføringsprotokoll, i én kort READ COMMITTED-transaksjon:

1. Lås tellesessionen FOR UPDATE NOWAIT. Alle session-RPC-er følger samme rekkefølge.
2. Lås sessionens locations-rad FOR UPDATE NOWAIT (ikke FOR NO KEY UPDATE). Dette konflikter med FK-kontrollens KEY SHARE og Vipers eksisterende FOR SHARE på samme lokasjon.
3. Lås alle inventory-rader på lokasjonen, i UUID-rekkefølge, FOR UPDATE NOWAIT. Pågående antallsendring, flytting ut eller sletting gir konflikt.
4. Les grunnlaget på nytt i en separat SQL-setning etter låsene. Sammenlign hele settet av inventory-ID-er, produkt, plassering, antall og grunnlagsrevisjon med lagrede tellelinjer. Nye/endrede/fjernede poster gir konflikt, ikke stille rebasering.
5. Beregn og lagre fullføring/hendelse én gang. Ikke ta produkt-, ordre- eller jobblåser etterpå. Commit frigjør låsene; ingen beholdning endres.

Nye poster og flytting inn stoppes av FK-låsen; eksisterende poster beskyttes av radlåser. Lokasjonslåsen alene beskytter ikke rene antallsendringer, og inventory-radlåser alene hindrer ikke nye poster. Sammen gir de nødvendig avgrensning. Vanlige lesinger og uavhengige lokasjoner kan fortsette. En flerlinjeoperasjon kan indirekte berøres dersom én linje gjelder den låste lokasjonen.

NOWAIT er viktig: eldre RPC-er kan holde inventory før de trenger lokasjonslåsen. Fullføringen skal da rulle tilbake straks i stedet for å vente i motsatt rekkefølge. Ingen SKIP LOCKED; manglende lås må aldri tolkes som manglende lagerpost. Konflikt mot katalogens EXCLUSIVE NOWAIT-barriere gir trygg avvisning. Kort lock_timeout/statement_timeout er fortsatt nødvendig for øvrige tabell-/DDL-låser; radlåsens NOWAIT gjør ikke alle låser ventefrie.

Forutsetninger før godkjenning: FK er validert og håndhevet i målmiljøet; ingen relevant skriver omgår FK/triggere; fullføringen bruker nye READ COMMITTED-snapshots, ikke ett gammelt statement-snapshot; session-operasjonene bruker samme låserekkefølge. Dette er undersøkt i migrasjonskoden, ikke ferskt mot produksjon.

Testkrav: to sesjoner med nye poster, flytting inn/ut, sletting, antallsendring, Viper-låseforløp, samme og annen lokasjon, samtidige tellelagringer, gjentatt fullføring og rollback. Også 10→9→10 krever grunnlagsrevisjon fra session-planen; sluttlåser erstatter ikke historisk endringsdeteksjon. Fysisk flytting under telling er fortsatt et operativt forhold.

Anbefaling: kombiner eksisterende FK med lokasjons-/radlåser fremfor global inventory-sperre. Ingen ny generell advisory-lock-protokoll eller omskriving av Viper er nødvendig. Pakke B er ikke implementert. Tosesjonstester av protokollen gjenstår før utrulling.

Referanse: https://www.postgresql.org/docs/17/explicit-locking.html (FOR UPDATE konflikter med KEY SHARE; radlåser gjelder til transaksjonsslutt).

## Lokal validering 15.11.2026

- 439 tester under tests/ bestått, 0 feil. Hele tests/-treet ble oppgitt eksplisitt for å unngå at Node oppfatter manuelle CLI-verktøy som tester. Første uavgrensede oppdagelse ventet på stdin i shopify-read-test.mjs; prosessen ble stoppet uten credentials/input eller Shopify-kall.
- 18 SQL-akseptansekontroller bestått på snake_phase2a_test_catalogfresh, loopback 127.0.0.1:55433, PostgreSQL 17.11, system-ID 7705827962930311860. Eksisterende guard kontrollerer også bruker og datakatalog.
- Migrasjon og syntetiske fixtures kjørt innen BEGIN/ROLLBACK. Etterpå ble gammel RPC-definisjon, antall inventory-rader, sum quantity og antall movement-/activity-rader kontrollert mot førverdier. Ny RPC finnes ikke etter rollback.
- Første SQL-forsøk stoppet på manglende pick_priority i den nye syntetiske fixturen. Fixture fikk eksplisitt syntetisk prioritet og sekvens, før målrettet ny kjøring. Ingen eksisterende database ble nullstilt.
- TypeScript og produksjonsbygg bestått. Første bygg var blokkert av sandboxens fontnettverk; ordinært bygg med fonttilgang bestod uten kodeendring.
- Lint: 0 feil, 23 advarsler. Diffkontroll uten whitespace-feil; Git varsler om vanlig LF/CRLF-konvertering.
- Syntetisk nettlesertest av den faktiske felles plasseringsdialogen: ren flytting sender ingen quantity, eksplisitt antallsvalg sender forventede førverdier, førstegangsregistrering sender register, Enter velger uten lagring. Mobil 390×844 kontrollert; Avbryt virker på første klikk med åpen treffliste. Ingen database koblet til forhåndsvisningen.
- Begrensninger: ingen ny innlogget produksjonstest, ingen faktisk mobilskjermtastaturtest, ingen tosesjonsakseptanse av Pakke A i denne kjøringen. SQL-testene dekker utdaterte snapshots, kollisjon, replay og rollback, men skal ikke omtales som samtidige tosesjonstester. Pakke B er kun dokumentert forslag.

Lokal forhåndsvisning: node scripts/warehouse-package-a-preview.mjs (localhost:3044). Lokal SQL-test: node scripts/warehouse-package-a-test.mjs --rollback-test; denne har fast allowlist og kan ikke velge eksternt mål.

Endrede produksjonsområder: navigasjon/Lager, pensjonerte Ryddemodus-ruter, begge produktflater og deres felles dialog/kontrakt, ny placement-API/RPC og Avvik-definisjoner/innlasting. Gamle Ryddemodus-kilder er bevart under archive/retired/ryddemodus som ikke-kjørbare tekstfiler. Ingen tellesession-tabeller, Viper-filer, lagerhendelses-RPC-er eller tilgangsroller er endret.
