type Input = {
  healthScore: number;
  quantityDiffs: number;
  missingLocations: number;
  missingZones: number;
  unresolvedIssues: number;
  placedCount: number;
};

export function getBorreObservation({
  healthScore,
  quantityDiffs,
  missingLocations,
  missingZones,
  unresolvedIssues,
  placedCount,
}: Input) {
  if (quantityDiffs > 0) {
    return `Quantity diff påvirker beholdning, plukk og Snake Health. Børre ville ikke brukt magefølelse her.`;
  }

  if (missingLocations > 0) {
    return `Produkter uten lokasjon er vanskelige å finne igjen. Det gir mer leting og dårligere flyt på lageret.`;
  }

  if (missingZones > 0) {
    return `Lokasjoner uten sone gjør strukturen svakere. Det blir vanskeligere å forstå hvor ting faktisk hører hjemme.`;
  }

  if (unresolvedIssues > 0) {
    return `Åpne saker bør ryddes mens de fortsatt er lette å forstå. Gamle avvik har en tendens til å gro fast.`;
  }

  if (placedCount === 0) {
    return `Ingen produkter er registrert med plassering ennå. Børre mistenker at lageret fortsatt venter på litt orden.`;
  }

  if (healthScore >= 95) {
    return `Det er få tydelige avvik akkurat nå. Børre anbefaler å fortsette å holde strukturen enkel og ryddig.`;
  }

  return `Børre ser ingen store overraskelser akkurat nå. Det viktigste er å holde lokasjoner og beholdning oppdatert.`;
}