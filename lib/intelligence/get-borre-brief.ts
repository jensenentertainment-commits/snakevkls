import { getNextAction } from "./get-next-action";
import { getSnakePulse } from "./snake-pulse";
import { getBorreMessage } from "./get-borre-message";
import { getBorreObservation } from "./get-borre-observation";


type Input = {
  diffCount: number;
  missingLocationCount: number;
  missingZoneCount: number;
  productCount?: number;
  collectionCount?: number;
  warehouseHealth?: number;
  unresolvedIssues?: number;
  pickEnabled?: boolean;
  placedCount?: number;
};

export function getBorreBrief(input: Input) {
  const nextAction = getNextAction(input);

  const warehouseHealth = input.warehouseHealth ?? 100;
  const unresolvedIssues = input.unresolvedIssues ?? 0;
  const pickEnabled = input.pickEnabled ?? false;

  const message = getBorreMessage({
  healthScore: warehouseHealth,
  quantityDiffs: input.diffCount,
  missingLocations: input.missingLocationCount,
  missingZones: input.missingZoneCount,
  unresolvedIssues,
});

const pulse = getSnakePulse({
  missingLocations: input.missingLocationCount,
  quantityDiffs: input.diffCount,
  unresolvedIssues,
  warehouseHealth,
  pickEnabled,
});

  

  const stats = [
    input.productCount ? `${input.productCount} produkter lest` : null,
    input.collectionCount ? `${input.collectionCount} collections oppdatert` : null,
    input.diffCount > 0 ? `${input.diffCount} lageravvik` : null,
    input.missingLocationCount > 0
      ? `${input.missingLocationCount} mangler lokasjon`
      : null,
    input.missingZoneCount > 0
      ? `${input.missingZoneCount} mangler sone`
      : null,
    nextAction.type === "empty" ? "Ingen kritiske ryddeoppgaver" : nextAction.title,
  ].filter((item): item is string => Boolean(item));

  return {
  title: "Børre",
  eyebrow: "Snake Intelligence",
  message,
  pulse,
  nextAction,
  stats,

  observation: getBorreObservation({
  healthScore: warehouseHealth,
  quantityDiffs: input.diffCount,
  missingLocations: input.missingLocationCount,
  missingZones: input.missingZoneCount,
  unresolvedIssues,
  placedCount: input.placedCount ?? 0,
}),
};
}