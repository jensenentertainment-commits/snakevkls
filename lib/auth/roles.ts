export const TARGET_ROLES = ["admin", "user", "warehouse"] as const;
export const LEGACY_ROLES = ["lager"] as const;
export const ROLES = [...TARGET_ROLES, ...LEGACY_ROLES] as const;

export type Role = (typeof ROLES)[number];
export type TargetRole = (typeof TARGET_ROLES)[number];
export type LegacyRole = (typeof LEGACY_ROLES)[number];
export type TransitionalRole = Role;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

export function isTransitionalRole(value: unknown): value is TransitionalRole {
  return isRole(value);
}

type AccessProfile = {
  role?: unknown;
  active?: unknown;
} | null;

export type AccessDecision = "unauthenticated" | "forbidden" | "allowed";

export function getAccessDecision({
  authenticated,
  profile,
  allowedRoles,
}: {
  authenticated: boolean;
  profile: AccessProfile;
  allowedRoles: readonly Role[];
}): AccessDecision {
  if (!authenticated) return "unauthenticated";

  if (
    !profile ||
    profile.active !== true ||
    !isRole(profile.role) ||
    !allowedRoles.includes(profile.role)
  ) {
    return "forbidden";
  }

  return "allowed";
}
