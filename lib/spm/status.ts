import fs from "fs/promises";
import path from "path";

const statusFile = path.join(
  process.cwd(),
  "spm-output",
  "status.json"
);

export async function getSpmStatus() {
  try {
    const json = await fs.readFile(statusFile, "utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function saveSpmStatus(
  patch: Record<string, unknown>
) {
  const current = (await getSpmStatus()) ?? {};

  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await fs.mkdir(
    path.dirname(statusFile),
    { recursive: true }
  );

  await fs.writeFile(
    statusFile,
    JSON.stringify(next, null, 2),
    "utf8"
  );

  return next;
}