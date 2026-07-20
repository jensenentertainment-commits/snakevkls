# Fase 1 – Auth og RLS

## Omfang

Fase 1 gjelder autentisering, aktiv brukerstatus og rollebasert tilgang. Rollemodellen består bare av `admin` og `lager`. Shopify-sync, Viper, SPM og øvrig funksjonalitet er ikke endret. Produksjonsdatabasen er kun inspisert med read-only spørringer; migrasjonen er ikke kjørt.

Begrensede eller midlertidige brukere inngår ikke i denne modellen. Et eventuelt behov for slike brukere må løses i en senere fase uten å utvide fase 1 med et nytt permission-system.

## Sikkerhetsmodell

Tilgang krever alltid:

1. En gyldig Supabase-bruker.
2. En tilhørende rad i `profiles`.
3. `profiles.active = true`.
4. Rollen `admin` eller `lager`.

Manglende profil, inaktiv profil og enhver annen eller historisk rolle avvises. Ingen rolle konverteres automatisk til `lager`.

`private.has_role(text[])` ligger i et ikke-eksponert skjema, kjører som `security definer`, har tom `search_path` og kontrollerer alltid `auth.uid()` mot en aktiv profil. RLS-kallene pakkes i `select` slik at rolleoppslaget kan evalueres én gang per statement.

## Rolle- og tilgangsmatrise

| Operasjon | admin | lager |
| --- | --- | --- |
| Lese `inventory`, `locations`, `zones`, `stock_movements`, `activity_log` | Ja | Ja |
| Opprette, endre og slette `inventory` | Ja | Ja |
| Opprette og endre `locations` | Ja | Ja |
| Slette `locations` direkte | Ja | Nei |
| Opprette, endre og slette `zones` | Ja | Nei |
| Registrere `stock_movements` | Ja | Ja |
| Endre eller slette historiske `stock_movements` | Nei | Nei |
| Opprette egen `activity_log`-rad | Ja | Ja |
| Endre eller slette `activity_log` | Nei | Nei |
| Administrere brukere, roller og systeminnstillinger | Ja | Nei |

Historikktabellene er append-only for begge roller. «Full admin-tilgang» betyr full tilgang til alle eksisterende arbeidsflyter og administrative funksjoner; det innebærer ikke omskriving eller sletting av revisjonshistorikk.

## Endrede RLS-policyer

De tidligere `Authenticated ...`-policyene erstattes av:

- `Active users read own profile`
- `Active users read inventory`, `Warehouse roles insert inventory`, `Warehouse roles update inventory`, `Warehouse roles delete inventory`
- `Active users read locations`, `Warehouse roles insert locations`, `Warehouse roles update locations`, `Admins delete locations`
- `Active users read zones`, `Admins insert zones`, `Admins update zones`, `Admins delete zones`
- `Active users read stock movements`, `Warehouse roles insert stock movements`
- `Active users read activity log`, `Active users insert activity log`

`anon` mister alle privilegier på de seks berørte tabellene. `authenticated` får bare tabellprivilegier som har en tilsvarende RLS-policy.

Den eksisterende `profiles_role_valid`-constrainten gjenbrukes med den nye to-rollemodellen. Den legges først til som `NOT VALID`, slik at en historisk ugyldig rolle ikke blir migrert eller blokkerer resten av sikkerhetsendringen. Hvis alle eksisterende profiler allerede er gyldige, valideres constrainten i samme migrasjon. Nye ugyldige roller avvises uansett.

## App- og API-håndheving

- Proxyen avviser manglende, inaktiv eller ugyldig profil på alle vanlige sider.
- `requireRole` gjør den samme kontrollen for API-ruter, inkludert ruter som bruker `service_role` etter autorisering.
- Lager- og lokasjonsoperasjoner tillater `admin` og `lager`.
- Soneadministrasjon, brukeradministrasjon, innstillinger, Arne, Labs, SPM og manuell Shopify-sync er admin-only.
- Cron og Shopify OAuth callback er eksplisitte systemintegrasjoner og bruker henholdsvis hemmelig token og OAuth state/HMAC i stedet for brukerrolle.

## Endrede filer

- `supabase/migrations/20260720210323_phase_1_auth_rls.sql`
- `lib/auth/roles.ts`, `lib/auth/require-role.ts`, `types/auth.ts`
- `lib/supabase/proxy.ts`
- Berørte auth-, navigasjons-, innstillings-, sone-, produkt- og kontosider under `app/`
- Berørte API-ruter under `app/api/`

## Testmatrise

Kjør migrasjonen først i en lokal database eller isolert Supabase development branch.

| Testidentitet | Forventet resultat |
| --- | --- |
| Aktiv adminprofil | Alle operative og administrative arbeidsflyter fungerer |
| Aktiv lagerprofil | Lager-, lokasjons-, telle- og ryddearbeid fungerer; adminfunksjoner gir 403/RLS-avslag |
| Inaktiv adminprofil | Ingen side-, API- eller tabelltilgang |
| Inaktiv lagerprofil | Ingen side-, API- eller tabelltilgang |
| Profil med ugyldig/historisk rolle | Ingen side-, API- eller tabelltilgang; ingen automatisk rolleendring |
| Gyldig auth-bruker uten profil | Ingen side-, API- eller tabelltilgang |
| Ingen auth-bruker | Redirect/401 og ingen tabelltilgang |

Manuelle flyter:

1. Test direkte SELECT/INSERT/UPDATE/DELETE med JWT for hver testidentitet.
2. Test alle service-role-baserte bruker-API-er direkte, ikke bare via UI.
3. Bekreft at lager kan plassere og fjerne varer, endre antall, telle, rydde og registrere lagerhendelser.
4. Bekreft at lager ikke kan endre soner, brukere, roller eller systeminnstillinger.
5. Bekreft at bare admin kan åpne og bruke sone- og brukeradministrasjon.
6. Bekreft at ugyldig rolle og manglende profil avvises både før og etter migrasjonen.
7. Bekreft at `activity_log.actor_id` må være innlogget bruker ved direkte klientinnsetting.
8. Kjør Supabase Security og Performance Advisors etter migrasjonen i testmiljøet.

## Utrullingsrekkefølge

Deploy appkoden før databasemigrasjonen. Den nye appkoden fungerer med dagens bredere constraint og begynner umiddelbart å avvise ugyldige roller. Deretter kan migrasjonen stramme inn RLS og constraint uten et vindu der gammel appkode fortsatt bruker service-role-data med svakere kontroll.

## Forhold utenfor fase 1

- Repositoryet mangler komplett lokal Supabase-konfigurasjon og tidligere migrasjonshistorikk.
- Supabase Advisors rapporterer andre tabeller uten policy, manglende FK-indekser, duplikate indekser og deaktivert leaked-password-beskyttelse. Dette er dokumentert, men ikke endret.
- Eksisterende genererte type- og repository-lintfeil utenfor auth/RLS ryddes ikke i denne fasen.
