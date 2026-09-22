#!/usr/bin/env node
"use strict";

/**
 * playtime forge - inflate the playtime and games-played badges.
 *
 * orcabase, 2026. mit licensed.
 *
 * posts launch_game and running_game_heartbeat events to /api/v9/science,
 * the same endpoint the real client uses to credit playtime.
 * duration_tracked_ms isn't validated server-side, so any number goes through.
 *
 * this violates discord tos. your account, your problem.
 */

const vault = require("./src/vault");
const session = require("./src/session");
const gamesMod = require("./src/games");
const features = require("./src/features");
const ui = require("./src/ui");
const auth = require("./src/auth");
const envstore = require("./src/envstore");
const { CH, info, pass, fail, warn, BULLET, blank, line } = require("./src/log");

const { PATHS, ENDPOINTS } = require("./src/config");
const { ORCA } = require("./src/banner");
const fmt = require("./src/format");

const ctx = { games: [] };

function quip() {
  return ORCA.quips[Math.floor(Math.random() * ORCA.quips.length)];
}

async function bootstrap() {
  blank();  const s = vault.load();
  const authState = s.token ? (s.cookie ? "ready" : "cookie missing") : "no token";

  info(`vault ${CH.dim}${BULLET}${CH.reset} ${PATHS.vault}`);
  info(`auth ${CH.dim}${BULLET}${CH.reset} ${authState}`);
  if (s.totals.titles > 0) {
    info(`history ${CH.dim}${BULLET}${CH.reset} ${fmt.int(s.totals.titles)} titles ${CH.dim}/${CH.reset} ${fmt.hours(s.totals.hours)} forged`);
  }
  blank();

  // token
  if (!s.token) {
    info("paste your discord account token");
    const tok = await ui.ask(`  ${CH.dim}token:${CH.reset} `);
    if (!tok) { fail("a token is required"); return false; }
    s.token = tok;
    vault.save();
    pass("token stored");
    // mirror into .env (write-only; loaded + printed via better-envforge below)
    envstore.sync({ token: tok });
  } else {
    pass(`token loaded ${CH.dim}(${auth.userIdFromToken(s.token) || "id unknown"})${CH.reset}`);
  }

  // cookie
  if (!s.cookie) {
    blank();
    info("paste your cf_clearance cookie header");
    info(`${CH.dim}discord.com -> devtools -> application -> cookies -> cf_clearance${CH.reset}`);
    const ck = await ui.ask(`  ${CH.dim}cookie:${CH.reset} `);
    if (!ck) { fail("a cookie is required"); return false; }
    s.cookie = ck;
    vault.save();
    pass("cookie stored");
    // mirror into .env (write-only; loaded + printed via better-envforge below)
    envstore.sync({ cookie: ck });
  } else {
    pass("cookie loaded");
  }

  // mirror check: load .env through better-envforge and print it
  blank();
  info("checking dynamic .env mirror...");
  envstore.loadAndPrint();

  // catalog
  blank();
  info("loading game catalog...");
  ctx.games = await gamesMod.loadGames();
  if (!ctx.games.length) {
    fail("couldn't load the game catalog");
    info(`tried ${PATHS.gameList} and ${ENDPOINTS.catalog}`);
    return false;
  }
  pass(`${CH.orange}${ctx.games.length}${CH.reset} titles indexed`);

  // fingerprint heads-up
  if (!vault.load().fingerprint) {
    warn("fingerprint not set - badges may not credit (menu 4 to bind one)");
  }

  // mint analytics token
  blank();
  info("establishing session...");
  try {
    await session.begin();
    if (!vault.tokenFresh()) await session.renew();
    pass("session established");
  } catch (e) {
    fail(String(e && e.message ? e.message : e));
    return false;
  }

  blank();
  info(quip());
  return true;
}

async function main() {
  const ok = await bootstrap();
  if (!ok) return;

  for (;;) {
    ui.paintMenu();
    const again = await ui.showMenu(ctx);
    if (!again) break;
  }

  blank();
  line();
  info("shutting down");
  info(`forged this session ${CH.dim}${BULLET}${CH.reset} thanks for flying orcabase`);
  line();
}

main()
  .catch((err) => {
    if (err && (err.name === "AbortError" || err.code === "ERR_USE_AFTER_CLOSE")) {
      console.log();
      fail("interrupted");
    } else {
      console.error(err);
    }
  })
  .finally(() => {
    ui.closeRl();
  });

process.on("SIGINT", () => {
  console.log();
  fail("interrupted");
  ui.closeRl();
  process.exit(130);
});
