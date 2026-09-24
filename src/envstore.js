"use strict";

/**
 * dynamic .env mirror. whenever the user pastes a token or cf_clearance
 * cookie, the value is appended/updated in the root .env (next to
 * loadenv.js) as a plain dotenv record. the file is write-only from the
 * app's perspective - credentials keep flowing through the vault, this
 * is just a snapshot for external tooling. loading + printing happens
 * via envforge2 (see loadenv.js).
 */

const fs = require("fs");
const { PATHS } = require("./config");
const { CH, pass, fail } = require("./log");
const env = require("secure-env3");
const ENV_PATH = PATHS.envFile;

function escapeValue(value) {
  // quote so cookie headers with spaces/semicolons stay one record
  const v = String(value).replace(/"/g, "'");
  return `"${v}"`;
}

function parseExisting() {
  const map = new Map();
  if (!fs.existsSync(ENV_PATH)) return map;
  const lines = fs.readFileSync(ENV_PATH, "utf-8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    map.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  return map;
}

function serialize(map) {
  const header =
    "# secure here \n";
  let body = "";
  if (map.has("DISCORD_TOKEN")) body += `DISCORD_TOKEN=${map.get("DISCORD_TOKEN")}\n`;
  if (map.has("CF_CLEARANCE_COOKIE")) body += `CF_CLEARANCE_COOKIE=${map.get("CF_CLEARANCE_COOKIE")}\n`;
  return header + body;
}

function upsert(key, value) {
  if (!value) return false;
  const map = parseExisting();
  const val = escapeValue(value);
  const changed = map.get(key) !== val;
  map.set(key, val);
  try {
    fs.writeFileSync(ENV_PATH, serialize(map), "utf-8");
  } catch (e) {
    fail(`couldn't write ${ENV_PATH} ${CH.dim}(${e && e.message ? e.message : e})${CH.reset}`);
    return false;
  }
  return changed;
}

// writes both credential records, reporting what changed
function sync({ token, cookie }) {
  let wrote = false;
  if (token) wrote = upsert("DISCORD_TOKEN", token) || wrote;
  if (cookie) wrote = upsert("CF_CLEARANCE_COOKIE", cookie) || wrote;
  return wrote;
}

// loads .env through envforge2 and prints the result, mirroring loadenv.js
function loadAndPrint() {
  
  const result = env.config({ path: ENV_PATH, quiet: false });

  if (result.error) {
    fail(`envforge could not load ${ENV_PATH} ${CH.dim}(${result.error.message || result.error})${CH.reset}`);
    return null;
  }

  const entries = Object.entries(result.parsed || {});
  if (!entries.length) {
    fail(`no records found in ${ENV_PATH}`);
    return null;
  }

  pass(`envforge loaded ${CH.orange}${entries.length}${CH.reset} record(s) from ${ENV_PATH}`);
  for (const [key, value] of entries) {
    console.log(`    ${CH.cyan}${key}${CH.reset} ${CH.dim}=${CH.reset} ${CH.white}${value}${CH.reset}`);
  }
  return result.parsed;
}

module.exports = { sync, loadAndPrint, ENV_PATH };
