export type NextActionType =
  | "diff"
  | "missing-location"
  | "missing-zone"
  | "empty";

export type NextAction = {
  type: NextActionType;
  title: string;
  description: string;
  href: string;
  priority: number;
  count: number;
};

type Input = {
  diffCount: number;
  missingLocationCount: number;
  missingZoneCount: number;
};

export function getNextAction({
  diffCount,
  missingLocationCount,
  missingZoneCount,
}: Input): NextAction {
  const actions: NextAction[] = [];

  if (diffCount > 0) {
    actions.push({
      type: "diff",
      title: "Rydd lageravvik først",
      description: `${diffCount} produkter har avvik mellom Shopify og Snake.`,
      href: "/products?status=diff",
      priority: 100,
      count: diffCount,
    });
  }

  if (missingLocationCount > 0) {
    actions.push({
      type: "missing-location",
      title: "Sett eksakte lokasjoner",
      description: `${missingLocationCount} produkter har sone, men mangler eksakt lokasjon.`,
      href: "/products?status=zone",
      priority: 80,
      count: missingLocationCount,
    });
  }

  if (missingZoneCount > 0) {
    actions.push({
      type: "missing-zone",
      title: "Plasser produkter i sone",
      description: `${missingZoneCount} produkter mangler både sone og lokasjon.`,
      href: "/products?status=missing",
      priority: 60,
      count: missingZoneCount,
    });
  }

  actions.sort((a, b) => b.priority - a.priority);

  return (
    actions[0] ?? {
      type: "empty",
      title: "Ingen kritiske lageroppgaver",
      description: "Snake finner ingen tydelige ryddeoppgaver akkurat nå.",
      href: "/products",
      priority: 0,
      count: 0,
    }
  );
}