# Fase 5: Fjern SPM

## Omfang

Fase 5 fjerner den pensjonerte Snake Product Migrator-modulen (SPM) uten å endre autentisering, RLS, Shopify-sync, lager-RPC-er, databaseskjema eller andre Snake-moduler.

## Fjernede filer og koblinger

Følgende SPM-ruter er fjernet:

- `app/labs/spm/page.tsx`
- alle 16 filer under `app/api/spm/`

Følgende SPM-implementasjon er fjernet:

- alle 20 filer under `lib/spm/`

Følgende genererte SPM-data er fjernet:

- `spm-output/ai-products.json`
- `spm-output/collections.json`
- `spm-output/products.json`
- `spm-output/shopify-product-index.json`
- `spm-output/status.json`
- `spm-output/shopify-products.csv`
- 472 genererte JPG-filer under `spm-output/images/`

Den pensjonerte SPM-flisen og lenken er fjernet fra `app/labs/page.tsx`. Direkte npm-avhengigheter som bare ble brukt av SPM er fjernet fra `package.json` og låsefilen: `cheerio`, `csv-stringify`, `fast-glob` og `sharp`.

## Delte komponenter og funksjoner som er beholdt

- `SnakeNav`, `SnakeFooter`, `SnakeHero` og `RoleGate`, som brukes utenfor SPM
- generell Shopify-klient, Shopify-sync og eksisterende `/api/shopify/*`-ruter
- generell produkt- og bildehåndtering; Next.js beholder sin transitive `sharp`-avhengighet
- `openai`, som fortsatt brukes av Arne/Børre
- fase 1–4-migrasjoner og dokumentasjon

Historiske fase 1–3-notater som sier at SPM var utenfor de respektive fasenes scope er beholdt som revisjonshistorikk. De er ikke kjørbar SPM-dokumentasjon.

## Testbevis

- `npm run build`: bestått med Next.js 16.2.4. Buildens app-manifest inneholder ingen `/labs/spm`- eller `/api/spm/*`-ruter, mens øvrige Labs-, Shopify- og lagerruter fortsatt bygges.
- `tsc --noEmit`: bestått.
- målrettet ESLint for `app/labs/page.tsx`: bestått uten feil eller advarsler.
- full `npm run lint`: 22 feil og 33 advarsler i urørte filer. Dette er eksisterende lint-gjeld utenfor fase 5; ingen av treffene ligger i fase 5-diffen.
- runtime mot produksjonsbuild lokalt: `/api/spm/status` returnerer `404`; `/labs` og `/labs/spm` returnerer eksisterende auth-redirect (`307`) uten innlogget sesjon. Fraværet av sideruten er derfor kontrollert i build-manifestet.
- søk i kjørbar kode finner ingen gjenværende SPM-importer, ruter, lenker eller `spm-output`-referanser.
- `git diff --check`: bestått.

## Risiko og avgrensninger

- Lagrede bokmerker eller eksterne kall til SPM vil nå få manglende rute, som er tilsiktet når modulen pensjoneres.
- Genererte SPM-resultater fjernes fra Git og kan ikke gjenopprettes av applikasjonen etter at SPM-koden er borte; de finnes fortsatt i Git-historikken.
- Full lint er fortsatt rød på eksisterende feil i urørte filer. Disse er ikke rettet fordi generell opprydding er utenfor fase 5.
- Labs-flisen for Arne peker allerede til `/borre/pro`, mens builden bare viser `/borre`. Dette var eksisterende før fase 5 og er dokumentert, men ikke endret.

Ingen migrasjon eller produksjonsendring inngår i fase 5.
