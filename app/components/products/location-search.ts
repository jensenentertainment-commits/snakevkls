import type { LocationOption } from "./types.ts";

export function searchLocations(locations: LocationOption[], query: string, zone: string) {
  const code = query.trim().toLocaleUpperCase("nb-NO");
  return locations.filter(location => Boolean(location.zone_id)
    && (!zone || location.zone_id === zone)
    && location.code.toLocaleUpperCase("nb-NO").includes(code));
}
