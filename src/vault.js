"use strict";

/**
 * v2 persisted state ("vault"). holds credentials, fingerprint, settings,
 * playtime counters, and rotation memory. silently imports a v1
 * science_state.json on first run so upgrades are painless.
 */

const fs = require("fs");
const { PATHS, LIMITS, DEFAULT_SETTINGS } = require("./config");

let cache = null;

function defaults() {
  return {
    version: 2,
    token: "",
    cookie: "",
    fingerprint: "",
    analyticsToken: "",
    mintedAt: 0,
    settings: { ...DEFAULT_SETTINGS },
    totals: { titles: 0, hours: 0, runs: 0 },
    lastRun: null,
    recentIds: [], // recently forged title ids, drives rotation
  };
}

function load() {
  if (cache) return cache;
  let data = null;

  if (fs.existsSync(PATHS.vault)) {
    try { data = JSON.parse(fs.readFileSync(PATHS.vault, "utf-8")); } catch (_) { data = null; }
  }
  if (!data && fs.existsSync(PATHS.legacyVault)) {
    try {
      const old = JSON.parse(fs.readFileSync(PATHS.legacyVault, "utf-8"));
      data = {
        version: 2,
        token: old.token || "",
        cookie: old.cookie || "",
        fingerprint: old.fingerprint || "",
        analyticsToken: old.analytics_token || "",
        mintedAt: old.fetched_at || 0,
        settings: { ...DEFAULT_SETTINGS },
        totals: {
          titles: old.total_games_claimed || 0,
          hours: old.total_hours_claimed || 0,
          runs: 0,
        },
        lastRun: null,
        recentIds: (old.used_games || []).slice(-LIMITS.replayMemory),
      };
    } catch (_) { data = null; }
  }
  cache = { ...defaults(), ...(data || {}) };
  cache.settings = { ...DEFAULT_SETTINGS, ...(cache.settings || {}) };
  cache.totals = { titles: 0, hours: 0, runs: 0, ...(cache.totals || {}) };
  cache.recentIds = Array.isArray(cache.recentIds) ? cache.recentIds.slice(-LIMITS.replayMemory) : [];
  return cache;
}

function save() {
  if (!cache) return;
  try {
    fs.writeFileSync(PATHS.vault, JSON.stringify(cache, null, 2), "utf-8");
  } catch (_) {
    // unwritable disk shouldn't crash a run
  }
}

function tokenFresh() {
  const s = load();
  if (!s.analyticsToken) return false;
  return Date.now() - s.mintedAt < LIMITS.tokenTTL;
}

function rotateMemory(ids) {
  const s = load();
  s.recentIds = s.recentIds.concat(ids).slice(-LIMITS.replayMemory);
  save();
}

module.exports = { load, save, tokenFresh, rotateMemory };
