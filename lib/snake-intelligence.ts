export type IntelligenceLevel = "stable" | "medium" | "high" | "critical";

export type SnakeMetrics = {
  missingLocationCount: number;
  quantityDiffCount: number;
  locationsWithoutZoneCount: number;
  placedCount: number;
};

export type RecommendedAction = {
  type: "diff" | "missing-location" | "missing-zone" | "stable";
  title: string;
  description: string;
  href: string;
  priorityLabel: string;
  level: IntelligenceLevel;
};

export function getRecommendedAction(metrics: SnakeMetrics): RecommendedAction {
  const {
    missingLocationCount,
    quantityDiffCount,
    locationsWithoutZoneCount,
  } = metrics;

  if (quantityDiffCount >= missingLocationCount && quantityDiffCount > 0) {
    return {
      type: "diff",
      title: "Rydd lageravvik først",
      description: `${quantityDiffCount} produkter har avvik mellom Shopify og Snake. Dette bør ryddes før videre arbeid.`,
      href: "/products?status=diff",
      priorityLabel: "Høy prioritet",
      level: quantityDiffCount > 100 ? "critical" : "high",
    };
  }

  if (missingLocationCount > 0) {
    return {
      type: "missing-location",
      title: "Sett eksakte lokasjoner",
      description: `${missingLocationCount} produkter mangler fast plassering. Start med ryddemodus.`,
      href: "/fix-locations",
      priorityLabel: "Neste steg",
      level: missingLocationCount > 20 ? "high" : "medium",
    };
  }

  if (locationsWithoutZoneCount > 0) {
    return {
      type: "missing-zone",
      title: "Rydd lokasjoner uten sone",
      description: `${locationsWithoutZoneCount} lokasjoner mangler sone. Dette bør ryddes for bedre struktur.`,
      href: "/locations",
      priorityLabel: "Struktur",
      level: "medium",
    };
  }

  return {
    type: "stable",
    title: "Lageret ser stabilt ut",
    description: "Snake finner ingen kritiske ryddeoppgaver akkurat nå.",
    href: "/products",
    priorityLabel: "Stabilt",
    level: "stable",
  };
}

export function getWarehouseHealth(metrics: SnakeMetrics) {
  const {
    missingLocationCount,
    quantityDiffCount,
    locationsWithoutZoneCount,
    placedCount,
  } = metrics;

  const totalKnownProducts = placedCount + missingLocationCount;

  const placementPenalty =
    totalKnownProducts > 0
      ? Math.round((missingLocationCount / totalKnownProducts) * 30)
      : 0;

  const diffPenalty = Math.min(40, Math.round(quantityDiffCount / 15));
  const zonePenalty = Math.min(20, locationsWithoutZoneCount * 5);

  const score = Math.max(
    0,
    Math.min(100, 100 - placementPenalty - diffPenalty - zonePenalty)
  );

  const level: IntelligenceLevel =
    score >= 85 ? "stable" : score >= 65 ? "medium" : score >= 40 ? "high" : "critical";

  return {
    score,
    level,
  };
}