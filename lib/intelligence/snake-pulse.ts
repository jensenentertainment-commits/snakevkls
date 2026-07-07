// lib/snake-pulse.ts

export type PulseCategory =
  | "stable"
  | "warning"
  | "critical"
  | "structure"
  | "activity"
  | "existential";

type PulseContext = {
  missingLocations?: number;
  quantityDiffs?: number;
  unresolvedIssues?: number;
  warehouseHealth?: number;
  pickEnabled?: boolean;
};

const PULSES: Record<PulseCategory, string[]> = {
  stable: [
    "Systemet fungerer som forventet. Det er alltid litt mistenkelig.",
    "Ingen kritiske avvik registrert. Foreløpig.",
    "Lageret holder formen. Snake følger med.",
    "Strukturen står. Det får holde for nå.",
    "Systempuls innenfor normale verdier.",
    "Alt ser rolig ut. Snake stoler ikke blindt på ro.",
    "Ingen store problemer funnet. Det føles nesten planlagt.",
    "Lageret oppfører seg pent akkurat nå.",
    "Systemet melder stabil drift. Ta det som en liten seier.",
    "Snake finner ingenting dramatisk. Det er uvanlig behagelig.",
    "Lokasjonene virker overraskende samarbeidsvillige.",
    "Dagens struktur holder foreløpig mål.",
    "Ingen akutte ryddesignaler oppdaget.",
    "Snake vurderer situasjonen som håndterbar.",
    "Systemet har ikke funnet noe å sukke over.",
    "Lageret ligger innenfor rimelig orden.",
    "Alt er ikke perfekt. Men det er heller ikke kaos.",
    "Snake rapporterer kontrollert stemning.",
    "Ingen røde flagg. Bare vanlig lagerliv.",
    "Strukturen puster normalt.",
  ],

  warning: [
    "Noe mangler plass. Det gjør det ofte.",
    "Ryddemodus peker på ting ingen savner å gjøre.",
    "Flere varer venter på fast adresse.",
    "Snake ser avvik. Snake dømmer ikke. Foreløpig.",
    "Lageret er nesten strukturert. Nesten er et sterkt ord.",
    "Noen produkter lever fortsatt uten fast tilhørighet.",
    "Systemet observerer små strukturelle ambisjoner.",
    "Det finnes varer som ennå ikke har funnet seg selv.",
    "Rydding anbefales før noen spør hvor varen ligger.",
    "Snake har sett nok til å anbefale moderat handling.",
    "Noen tall virker mer optimistiske enn andre.",
    "Lageret driver svakt ut av struktur.",
    "Enkelte plasseringer virker teoretiske.",
    "Dette er ikke krise. Men det er heller ikke vakkert.",
    "Noen avvik har begynt å danne miljø.",
    "Systemet anbefaler rolig, men bestemt opprydding.",
    "Lageret sender svake signaler om at noen bør gjøre noe.",
    "Snake merker små uregelmessigheter. De merker ikke Snake.",
    "Noen varer står fortsatt i eksistensiell mellomposisjon.",
    "Ryddemodus finnes av en grunn.",
  ],

  critical: [
    "Snake anbefaler rydding før optimisme.",
    "Lagerkonsistensen har tatt seg en liten spasertur.",
    "Flere avvik har samlet seg i samme rom.",
    "Systemet er våkent. Det er ikke nødvendigvis gode nyheter.",
    "Operativ stabilitet er redusert. Stemningen likeså.",
    "Strukturavvik overstiger komfortsonen.",
    "Snake foreslår handling før dette blir tradisjon.",
    "Flere forhold krever oppmerksomhet. Gjerne i dag.",
    "Dette er et godt tidspunkt å ikke ignorere tallene.",
    "Avvikene begynner å se organiserte ut.",
    "Systemet anbefaler korrigerende arbeid. Høflig, men bestemt.",
    "Lageret har mistet litt av tråden.",
    "Snake registrerer uro i strukturen.",
    "Noen tall har sluttet å late som.",
    "Kritisk nivå er ikke dramatikk. Bare matematikk med dårlig stemning.",
    "Systemet peker. Det peker ikke tilfeldig.",
    "Lageret trenger voksen tilsyn.",
    "Snake har notert seg flere ting. Ingen av dem er pynt.",
    "Avvikene bør håndteres før de får personlighet.",
    "Dette er ikke dagen for å stole på magefølelsen alene.",
  ],

  structure: [
    "Struktur før hastighet. Alltid.",
    "En vare uten plass er bare en fremtidig leteaksjon.",
    "Lokasjoner gir ro. Ro gir færre rare blikk.",
    "Sone først. Panikk senere.",
    "Fast plassering er lagerets måte å puste på.",
    "Alt har en plass. Det er teorien.",
    "Rydding er struktur forklart med bevegelse.",
    "Noen lokasjoner føles mer voksne enn andre.",
    "Lageret liker tydelige adresser.",
    "En god lokasjon sparer en dårlig samtale.",
    "Snake foretrekker varer med fast bosted.",
    "Struktur er bare kaos som har fått navnelapp.",
    "Lokasjoner brukes når fremtiden skal bli mindre irriterende.",
    "Et produkt uten lokasjon er et spørsmål noen må svare på senere.",
    "Sonestruktur vurderes kontinuerlig. Mer eller mindre frivillig.",
    "Fast plassering gir roligere drift.",
    "Ingen savner struktur før de trenger den.",
    "Snake liker ting som står der de sa de skulle stå.",
    "Lageret blir lettere å forstå når varene slutter å improvisere.",
    "Plassering er ikke glamour. Det er derfor den virker.",
  ],

  activity: [
    "Systemet overvåker. Ikke omvendt.",
    "Aktivitet registreres fortløpende.",
    "Snake følger bevegelsene i lageret.",
    "Noen endringer føles mer gjennomtenkte enn andre.",
    "Arbeidsflyt vurderes kontinuerlig.",
    "Snake har notert seg dette.",
    "Endringer spores. Stemningen tolkes ikke.",
    "Systemet ser mønstre ingen har bedt om.",
    "Lageret beveger seg. Snake tar notater.",
    "Noen handlinger blir historikk. Andre blir spørsmål.",
    "Aktivitet finnes. Det er et godt tegn.",
    "Snake registrerer spor etter menneskelig inngripen.",
    "Systemet følger med i stillhet.",
    "Endringer skjer. Snake gjør sitt beste med informasjonen.",
    "Lageret etterlater seg digitale fotspor.",
    "Snake observerer uten å klappe.",
    "Noen har gjort noe. Systemet har skrevet det ned.",
    "Historikk bygges én liten handling av gangen.",
    "Snake lagrer minner. Ikke følelser.",
    "Driften beveger seg i målbare former.",
  ],

  existential: [
    "Ingen bærer tirsdagen helt likt.",
    "Dagen står fortsatt inne for deler av seg selv.",
    "Det hjelper å stå litt skrått i store rom.",
    "Ingen feil registrert. Dette er ikke nødvendigvis beroligende.",
    "Systemet vurderte å si noe annet. Det gikk over.",
    "Alle varer befinner seg et sted. Dette er mer imponerende enn det høres ut som.",
    "Noen lokasjoner føles eldre enn andre.",
    "Lageret virker rolig. Snake stoler ikke på ro.",
    "Det finnes mandager som ikke lar seg indeksere.",
    "Noen ganger er struktur bare en form for håp.",
    "Systemet hørte ingenting. Det betyr sannsynligvis ingenting.",
    "Ingen blir lettere av å stå for nær en fruktskål.",
    "Alt som står stille, venter egentlig bare.",
    "Snake kommenterer sjelden. Dette var ikke et løfte.",
    "Dagen er registrert, men ikke nødvendigvis godkjent.",
    "Lageret har ikke sagt noe. Det er typisk.",
    "Noen tall føles mer personlige enn andre.",
    "Systemet er rolig. Det betyr ingenting.",
    "Ingen vet hvorfor akkurat denne hyllen virker skeptisk.",
    "Det finnes orden. Og så finnes det lager.",
  ],
};

function pickItem<T>(items: T[], seed: number): T {
  const index = Math.abs(seed) % items.length;
  return items[index];
}

function maybeDynamicPulse(
  context: Required<PulseContext>,
  seed: number
): string | null {
  const dynamic: string[] = [];

  if (context.missingLocations > 0) {
    dynamic.push(
      `${context.missingLocations} produkter mangler lokasjon. De virker overraskende komfortable med situasjonen.`
    );
  }

  if (context.quantityDiffs > 0) {
    dynamic.push(
      `${context.quantityDiffs} produkter har avvik. Snake foreslår at vi ikke later som dette er pynt.`
    );
  }

  if (context.unresolvedIssues > 0) {
    dynamic.push(
      `${context.unresolvedIssues} ting bør sjekkes. Ikke krise, men heller ikke dekor.`
    );
  }

  if (context.warehouseHealth < 40) {
    dynamic.push(
      `Snake Health er ${context.warehouseHealth}/100. Systemet anbefaler rolig alvor.`
    );
  }

  if (!context.pickEnabled) {
    dynamic.push("Plukkemodul avventer modenhet.");
  }

  if (dynamic.length === 0) return null;

  return pickItem(dynamic, seed);
}

export function getSnakePulse(context?: PulseContext) {
  const safeContext: Required<PulseContext> = {
    missingLocations: context?.missingLocations ?? 0,
    quantityDiffs: context?.quantityDiffs ?? 0,
    unresolvedIssues: context?.unresolvedIssues ?? 0,
    warehouseHealth: context?.warehouseHealth ?? 100,
    pickEnabled: context?.pickEnabled ?? false,
  };

  const seed =
    safeContext.missingLocations * 3 +
    safeContext.quantityDiffs * 5 +
    safeContext.unresolvedIssues * 7 +
    safeContext.warehouseHealth * 11 +
    (safeContext.pickEnabled ? 13 : 17);

  const shouldUseDynamic = seed % 5 === 0;

  if (shouldUseDynamic) {
    const dynamicPulse = maybeDynamicPulse(safeContext, seed);

    if (dynamicPulse) return dynamicPulse;
  }

  const categories: PulseCategory[] = [];

  if (
    safeContext.quantityDiffs > 300 ||
    safeContext.unresolvedIssues > 50 ||
    safeContext.warehouseHealth < 40
  ) {
    categories.push("critical", "critical");
  }

  if (
    safeContext.missingLocations > 10 ||
    safeContext.quantityDiffs > 50 ||
    safeContext.unresolvedIssues > 10
  ) {
    categories.push("warning", "warning");
  }

  if (!safeContext.pickEnabled || safeContext.missingLocations > 0) {
    categories.push("structure");
  }

  categories.push("activity");

  if (
    safeContext.warehouseHealth >= 80 &&
    safeContext.quantityDiffs < 20 &&
    safeContext.missingLocations < 5
  ) {
    categories.push("stable", "stable");
  }

  if (seed % 7 === 0) {
    categories.push("existential");
  }

  const selectedCategory = pickItem(
    categories.length ? categories : (["stable"] as PulseCategory[]),
    seed
  );

  return pickItem(PULSES[selectedCategory], seed + selectedCategory.length);
}