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
  assert.match(source, /await assertPageSafe\(page, "pointer inspection"\)/);
  assert.match(source, /: await findObservedPage\(\)/);
  assert.match(source, /ref from a fresh snapshot is required/);
  assert.match(source, /pageChangeDwellMs = 5 \* 1000/);
  assert.match(source, /pageTextCaptureDelayMs = 15 \* 1000/);
  assert.match(source, /event\.text = previewText/);
  assert.doesNotMatch(source, /document\.cookie|localStorage|sessionStorage/);
  assert.doesNotMatch(source, /\/browser\/screenshot|dataBase64/);
});
