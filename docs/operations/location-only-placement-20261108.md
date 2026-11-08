# Lokasjonsbasert vareplassering — lokal endring

Separat fra den gjennomførte engangsnullstillingen. Ingen deploy eller migrasjon utført.

- Produktsiden og produktdetaljen bruker samme dialog: konkret aktiv lokasjon og antall. Sone vises automatisk fra lokasjonen.
- API-et krever locationId og sender requested_zone_id=NULL til eksisterende set_product_location. RPC-en validerer aktiv lokasjon og utleder sonen autoritativt.
- Manuelt sonevalg, sone-only-hurtigvalg og masseplassering til sone er fjernet. Gammel batch-zone-rute beholder rollekravet, men svarer 410 uten databasekall. Ingen delvis/ikke-atomisk erstatning for masseplassering er innført.
- Sonefiltrering, sonevisning, soneprioritet, lesing av historiske soneposter og UUID-baserte koblinger beholdes. Viper og Lagersalg er uendret.
- Databasefunksjoner/constraints er uendret. Dette fjerner sone-only-plassering fra ordinære app/API-innganger, ikke fra administrative SQL-muligheter.

Seks nye lokale regresjonstester dekker manglende lokasjon, autoritativ sone, bevart lagerpostidentitet/antall, rolle- og antallskontroll, gammel batch-rute og åpning av plasseringsdialog med og uten eksisterende lagerpost. Ingen muterende databaseprøver eller nettleserlagringer ble utført.

Utrulling er godkjent etter bestått visuell kontroll. Gammel produksjonsversjon har fortsatt tidligere grensesnitt frem til deploy.

Sluttvalidering: 505/505 tester bestod (eksplisitt alle *.test.ts/*.test.mjs/*.test.js under tests og lib), TypeScript bestod, lint 0 feil / 28 advarsler, produksjonsbygg bestod og diffkontroll bestod. Første bygg ble blokkert av Google Fonts-nettverkstilgang; nytt bygg med nettverkstilgang bestod. Bred automatisk testoppdagelse tok med det manuelle shopify-read-test-verktøyet, som ventet på stdin uten legitimasjon/API-kall; denne kjøringen ble stoppet og erstattet med eksplisitt testfilliste. Ingen tester eller forventninger ble svekket. Visuell nettlesertest er ikke utført i denne oppgaven.

Visuell etterkontroll 2026-11-08: Bestått i isolert kildekopi mot snake-test, system-ID 7702071863184491885. Eksisterende Viper-preview-sperrer er ikke endret. Egen midlertidig proxy tillot kun plasseringsskriving for den nye syntetiske varen PLACEMENT-UI-20261108 og to eksplisitte testlokasjoner. Ingen produksjonshemmeligheter eller Shopify-tilkobling ble brukt.

- Ny plassering: VUI01-01-A, automatisk sone VUI, tre enheter.
- Flytting: VE2E01, automatisk sone VE2E, fortsatt tre enheter og én lagerpost. Én lagerkorrigering +3 ved opprettelse; ingen ekstra uttak/tillegg ved flytting.
- Sonefilter: varen forsvant fra VUI og ble vist i VE2E etter lagring.
- Smal produktliste og bred tabell/produktdetalj viste korrekt lokasjon, sone og antall. Dialogen hadde bare lokasjonsvalg og antall; lagring var deaktivert uten lokasjon.
- Alle tidligere testlagerposter, lokasjoner og soner ble sammenlignet før/etter og var identiske. Plukkprioritering og øvrige lagerfunksjoner er dekket av uendrede databasekontrakter og eksisterende regresjonstester, ikke en ny fysisk plukkpilot.
- Den syntetiske varen og testhistorikken beholdes i snake-test som bevis; eksisterende Viper-resultater er bevart.

Operativ cleanup-SQL/manifest, sertifikater og midlertidig teststart inngår ikke i UI-leveransen.
