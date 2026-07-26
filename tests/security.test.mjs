import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("control service keeps public-safe defaults", async () => {
  const source = await readFile(path.join(root, "src", "control-server.mjs"), "utf8");
  assert.match(source, /SAMEWINDOW_CONTROL_HOST \|\| "127\.0\.0\.1"/);
  assert.match(source, /SAMEWINDOW_ALLOW_SENSITIVE_AUTOMATION === "1"/);
  assert.match(source, /await assertPageSafe\(page, "snapshot"\)/);
  assert.match(source, /await assertPageSafe\(page, "screenshot"\)/);
  assert.match(source, /await assertPageSafe\(page, "pointer inspection"\)/);
  assert.match(source, /: await findObservedPage\(\)/);
  assert.match(source, /ref from a fresh snapshot is required/);
  assert.doesNotMatch(source, /document\.cookie|localStorage|sessionStorage/);
});
