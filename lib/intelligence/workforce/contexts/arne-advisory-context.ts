import type { getArneDevelopmentContext } from "../../arne/development-context";
import type { getSnakeOperationalContext } from "../../shared/operational-context";

export type ArneAdvisoryContext = {
  readonly snakeKnowledge: string;
  readonly developmentContext: ReturnType<typeof getArneDevelopmentContext>;
  readonly operationalContext: Awaited<
    ReturnType<typeof getSnakeOperationalContext>
  >;
  readonly page: string | null;
};
