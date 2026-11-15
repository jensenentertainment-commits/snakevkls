import type { getArneDevelopmentContext } from "../../arne/development-context";

export type ArneAdvisoryContext = {
  readonly developmentContext: ReturnType<typeof getArneDevelopmentContext>;
  readonly page: string | null;
};
