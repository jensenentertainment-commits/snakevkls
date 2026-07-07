type Input = {
  healthScore: number;
  quantityDiffs: number;
  missingLocations: number;
  missingZones: number;
  unresolvedIssues: number;
};

export function getBorreMessage({
  healthScore,
  quantityDiffs,
  missingLocations,
  missingZones,
  unresolvedIssues,
}: Input) {
  if (quantityDiffs > 0) {
    return `${quantityDiffs} produkter har quantity diff. Det er det viktigste å rydde først.`;
  }

  if (missingLocations > 0) {
    return `${missingLocations} produkter mangler lokasjon. Børre ville gitt dem fast plass før videre rydding.`;
  }

  if (missingZones > 0) {
    return `${missingZones} lokasjoner mangler sone. Det bør ryddes før strukturen blir vanskelig å stole på.`;
  }

  if (unresolvedIssues > 0) {
    return `${unresolvedIssues} ting bør sjekkes. Børre ville tatt dem før de blir gamle saker.`;
  }

  if (healthScore >= 95) {
    return `Snake Health er ${healthScore}/100. Lageret ser ryddig ut akkurat nå.`;
  }

  return `Snake Health er ${healthScore}/100. Lageret virker håndterbart akkurat nå.`;
}