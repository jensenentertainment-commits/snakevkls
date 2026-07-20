export type { Role } from "@/lib/auth/roles";

import type { Role } from "@/lib/auth/roles";

export type Profile = {
  id: string;
  email: string | null;
  role: Role;
  created_at: string;
  display_name: string | null;
  active: boolean;
};

export type UserProfile = {
  role: Role;
  active: boolean;
  display_name: string | null;
};
