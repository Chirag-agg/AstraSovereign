#!/usr/bin/env node
// Offline "install" for the presentation renderer.
//
// The full PptxGenJS runtime dependency closure is committed under
// presentation/node_modules, so on an air-gapped machine there is nothing to
// fetch. This script verifies that vendored closure and reads the library the
// renderer actually uses. It never touches the network and never calls npm.

const path = require("path");
const fs = require("fs");

const presentationDir = path.resolve(__dirname, "..");
const nodeModules = path.join(presentationDir, "node_modules");

// Full runtime closure of pptxgenjs@4.0.1 (pure JS, no native builds).
const REQUIRED = [
  "pptxgenjs",
  "jszip",
  "image-size",
  "https",
  "pako",
  "readable-stream",
  "lie",
  "immediate",
  "queue",
  "inherits",
  "core-util-is",
  "isarray",
  "process-nextick-args",
  "safe-buffer",
  "string_decoder",
  "setimmediate",
  "util-deprecate",
];

function fail(message) {
  console.error(`[presentation] offline check FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(nodeModules)) {
  fail("presentation/node_modules is missing; the offline bundle is incomplete");
}

for (const name of REQUIRED) {
  if (!fs.existsSync(path.join(nodeModules, name, "package.json"))) {
    fail(`vendored dependency '${name}' is missing under presentation/node_modules`);
  }
}

let version;
try {
  version = require(path.join(nodeModules, "pptxgenjs", "package.json")).version;
} catch (err) {
  fail(`could not read the vendored pptxgenjs package: ${err.message}`);
}

console.log(
  JSON.stringify({ ok: true, offline: true, pptxgenjs: version, node: process.version }),
);
