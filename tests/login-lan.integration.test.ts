import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("LAN development origin is explicitly allowed", async () => {
  const config = await source("next.config.ts");
  assert.match(config, /allowedDevOrigins:\s*\["192\.168\.10\.113"\]/);
});

test("login prevents native submit and runs Supabase password auth", async () => {
  const form = await source("app/login/LoginForm.tsx");

  assert.match(form, /e\.preventDefault\(\)/);
  assert.match(form, /<form\s+[\s\S]*onSubmit=\{handleLogin\}/);
  assert.match(form, /type="submit"/);
  assert.match(form, /supabase\.auth\.signInWithPassword/);
  assert.match(form, /window\.location\.assign\(nextPath\)/);
  assert.match(form, /Kunne ikke kontakte innloggingstjenesten/);
  assert.doesNotMatch(form, /<form[^>]*\saction=/);
});

test("login accepts only local post-authentication paths", async () => {
  const page = await source("app/login/page.tsx");

  assert.match(page, /value\.startsWith\("\/"\)/);
  assert.match(page, /!value\.startsWith\("\/\/"\)/);
  assert.match(page, /return "\/dashboard"/);
});
