"use strict";

/**
 * static knobs for the forge. paths, endpoints, client identity, defaults.
 */

const path = require("path");

const ROOT = path.join(__dirname, "..");

const PATHS = {
  vault: path.join(ROOT, "vault.json"),                        // v2 state
  legacyVault: path.join(ROOT, "science_state.json"),          // v1 state, imported once
  journal: path.join(ROOT, "journal.jsonl"),                   // per-run history
  envFile: path.join(ROOT, ".env"),                            // dynamic env mirror (see loadenv.js)
  gameList: path.join(ROOT, "..", "data", "games.json"),       // detectables cache
};

const ENDPOINTS = {
  identity: "https://discord.com/api/v9/users/@me?with_analytics_token=true",
  science: "https://discord.com/api/v9/science",
  props: "https://cordapi.dolfi.es/api/v2/properties/windows",
  catalog: "https://cdn.discordapp.com/detectables/games.json",
};

const LIMITS = {
  tokenTTL: 12 * 60 * 60 * 1000, // analytics token lifetime before a re-mint
  journalTail: 15,               // rows shown in the journal view
  replayMemory: 800,             // how many recently-forged ids to remember
};

const CLIENT = {
  release: "1.0.9253",
  build: 594031,
  nativeBuild: 88414,
  osRelease: "10.0.26200",
  electron: "42.7.1",
  locale: "en-GB",
  timezone: "Europe/Oslo",
  agent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) discord/1.0.9253 Chrome/148.0.7778.280 " +
    "Electron/42.7.1 Safari/537.36",
};

const DEFAULT_SETTINGS = {
  batchSize: 50,      // titles per /science request
  batchPauseMs: 300,  // breathing room between requests
  wobble: true,       // ±3% drift on logged hours
  dryRun: false,      // build events, send nothing
  hoursDefault: 1,    // fallback answer for the hours prompt
};

module.exports = { PATHS, ENDPOINTS, LIMITS, CLIENT, DEFAULT_SETTINGS };
