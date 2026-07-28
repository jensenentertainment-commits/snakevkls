import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function readProjectFile(file: string) {
  return readFileSync(join(root, file), "utf8");
}

test("Account uses the generic shell without duplicate navigation", () => {
  const account = readProjectFile("app/account/page.tsx");
  const config = readProjectFile("app/components/shell/route-config.ts");
  const navigation = readProjectFile(
    "app/components/navigation/modules.ts",
  );
  const userMenu = readProjectFile(
    "app/components/layout/AppUserMenu.tsx",
  );
  const mobileNav = readProjectFile(
    "app/components/layout/MobileNav.tsx",
  );

  assert.match(navigation, /href: "\/account",[\s\S]+?id: "account"/);
  assert.match(
    config,
    /id: "account",[\s\S]+?moduleNavigation: undefined,[\s\S]+?navigationItem: ACCOUNT_NAVIGATION_ITEM,[\s\S]+?width: "wide"/,
  );
  assert.match(userMenu, /accountHref = "\/account"/);
  assert.match(mobileNav, /accountHref = "\/account"/);
  assert.doesNotMatch(account, /SnakeNav|SnakeFooter|ModuleNav/);
});

test("Account preserves authentication, profile data, and save behavior", () => {
  const account = readProjectFile("app/account/page.tsx");
  const profileCard = readProjectFile(
    "app/components/account/AccountProfileCard.tsx",
  );
  const passwordCard = readProjectFile(
    "app/components/settings/ChangePasswordCard.tsx",
  );

  assert.match(account, /supabase\.auth\.getUser\(\)/);
  assert.match(account, /redirect\("\/login"\)/);
  assert.match(account, /redirect\("\/login\?error=access_denied"\)/);
  assert.match(account, /\.from\("profiles"\)/);
  assert.match(account, /\.from\("activity_log"\)/);
  assert.match(account, /<AccountProfileCard/);
  assert.match(account, /<ChangePasswordCard/);
  assert.match(profileCard, /fetch\("\/api\/account\/profile"/);
  assert.match(profileCard, /method: "POST"/);
  assert.match(passwordCard, /supabase\.auth\.updateUser/);
});
