#!/usr/bin/env node
/**
 * Re-measure every figure in src/lib/metrics.ts against the repository.
 *
 * The landing page states numbers about this codebase. Numbers rot. This
 * script recounts them from source and exits non-zero on a mismatch, so a
 * stale claim fails a check instead of quietly misleading a reader.
 *
 * Usage:  npm run verify:metrics
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");

function sh(command) {
  return execSync(command, { cwd: repo, encoding: "utf8", shell: "/bin/bash" }).trim();
}

const measured = {
  "Backend tests": sh(`grep -rhcE '^\\s*(async )?def test_' backend/tests/*.py | paste -sd+ | bc`),
  "Agent tools": sh(`grep -cE '^\\s+name = "' backend/app/services/tools.py`),
  "Local models": sh(
    `python3 -c "import yaml,sys; d=yaml.safe_load(open('config/models.yaml')); print(len(d['models']))"`,
  ),
  "HTTP routes": sh(`grep -rhoE '@router\\.(get|post|delete|put)\\("[^"]+"' backend/app/api/*.py | wc -l`),
  "Backend Python": sh(`find backend/app -name '*.py' | xargs wc -l | tail -1 | awk '{print $1}'`),
  "Frontend tests": sh(
    `grep -rhoE '\\b(it|test)\\(' frontend/src --include=*.test.tsx --include=*.test.ts | wc -l`,
  ),
};

const source = readFileSync(path.join(repo, "frontend/src/lib/metrics.ts"), "utf8");

/** Pull `value` out of the metric object whose `label` matches. */
function claimed(label) {
  const block = source.split(`label: "${label}"`)[1];
  if (!block) return null;
  const match = block.match(/value:\s*"([^"]+)"/);
  return match ? match[1].replace(/,/g, "") : null;
}

let failures = 0;
console.log("metric".padEnd(20), "claimed".padEnd(12), "measured");
console.log("-".repeat(48));
for (const [label, actual] of Object.entries(measured)) {
  const stated = claimed(label);
  const ok = stated !== null && String(actual) === stated;
  if (!ok) failures += 1;
  console.log(
    label.padEnd(20),
    String(stated ?? "—").padEnd(12),
    String(actual),
    ok ? "" : "  ✗ MISMATCH",
  );
}

// The mark plate draws its radar from MODEL_ROSTER and names the classifier
// from EMBEDDING_MODEL, so both are checked against their sources as well.
const yamlRoster = JSON.parse(
  sh(
    `python3 -c "import yaml,json; d=yaml.safe_load(open('config/models.yaml'))['models']; print(json.dumps({k:[v['model'],(v.get('resources') or {}).get('gpu_vram_mb')] for k,v in d.items()}))"`,
  ),
);
const rosterBlock = source.split("export const MODEL_ROSTER")[1]?.split("] as const")[0] ?? "";
for (const m of rosterBlock.matchAll(/capability: "(\w+)", model: "([^"]+)", vram_mb: (\d+)/g)) {
  const [, capability, model, vram] = m;
  const truth = yamlRoster[capability];
  const ok = Boolean(truth) && truth[0] === model && String(truth[1]) === vram;
  if (!ok) failures += 1;
  console.log(
    `roster:${capability}`.padEnd(20),
    `${vram}MB`.padEnd(12),
    truth ? `${truth[1]}MB ${truth[0]}` : "missing",
    ok ? "" : "  ✗ MISMATCH",
  );
}
const embedClaim = source.match(/EMBEDDING_MODEL = \{[^}]*model: "([^"]+)"/)?.[1];
const embedTruth = sh(`grep -oP 'embedding_model: str = "\\K[^"]+' backend/app/config.py`);
if (embedClaim !== embedTruth) failures += 1;
console.log("embedding model".padEnd(20), String(embedClaim).padEnd(12), embedTruth, embedClaim === embedTruth ? "" : "  ✗ MISMATCH");

if (failures > 0) {
  console.error(`\n${failures} metric(s) out of date — update frontend/src/lib/metrics.ts.`);
  process.exit(1);
}
console.log("\nAll metrics match the repository.");
