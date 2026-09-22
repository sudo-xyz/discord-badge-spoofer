"use strict";

/**
 * game catalog: cached detectables list with a cdn fallback.
 */

const fs = require("fs");
const path = require("path");
const { PATHS, ENDPOINTS } = require("./config");

function windowsExecutable(entry) {
  for (const exe of entry.executables || []) {
    if (exe && exe.os === "win32" && exe.name) return exe.name;
  }
  return "game.exe";
}

function parseCatalog(raw) {
  const data = JSON.parse(raw);
  const seen = new Set();
  const games = [];
  for (const entry of Array.isArray(data) ? data : []) {
    const id = String(entry && entry.id != null ? entry.id : "");
    if (!/^\d+$/.test(id) || seen.has(id)) continue;
    const execs = entry.executables || [];
    if (!execs.some((e) => e && e.os === "win32" && e.name)) continue;
    seen.add(id);
    games.push({ id, name: entry.name || "Unknown", exe: windowsExecutable(entry) });
  }
  return games;
}

async function downloadCatalog() {
  const res = await fetch(ENDPOINTS.catalog, { headers: { "User-Agent": "Mozilla/5.0" } });
  const raw = await res.text();
  try {
    fs.mkdirSync(path.dirname(PATHS.gameList), { recursive: true });
    fs.writeFileSync(PATHS.gameList, raw, "utf-8");
  } catch (_) {
    // cache write is best-effort
  }
  return raw;
}

async function loadGames() {
  let raw = "";
  if (fs.existsSync(PATHS.gameList)) {
    try { raw = fs.readFileSync(PATHS.gameList, "utf-8").trim(); } catch (_) { raw = ""; }
  }
  if (raw) {
    try {
      const games = parseCatalog(raw);
      if (games.length) return games;
    } catch (_) {
      // corrupt cache, re-download below
    }
  }
  try {
    return parseCatalog(await downloadCatalog());
  } catch (_) {
    return [];
  }
}

function searchGames(games, query) {
  const q = query.trim().toLowerCase();
  if (!q) return games.slice(0, 25);
  return games.filter((g) => g.name.toLowerCase().includes(q)).slice(0, 25);
}

module.exports = { loadGames, parseCatalog, searchGames };
