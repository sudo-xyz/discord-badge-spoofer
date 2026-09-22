"use strict";

/**
 * dispatch loop: chunks forged sessions into /science batches and records the
 * run into the journal.
 */

const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { ENDPOINTS, PATHS, CLIENT } = require("./config");
const vault = require("./vault");
const session = require("./session");
const { CH, info, pass, warn, fail, BULLET } = require("./log");

function nextBatchPause(settings, index) {
  // base pause with a little jitter so request spacing isn't robotic
  const base = settings.batchPauseMs;
  const jitter = Math.floor((Math.random() - 0.5) * base * 0.6);
  return Math.max(50, base + jitter + index * 2);
}

function journalAppend(entry) {
  try {
    fs.appendFileSync(PATHS.journal, JSON.stringify(entry) + "\n", "utf-8");
  } catch (_) {
    // journal is best-effort
  }
}

async function runForges(games, buildEventsFor, settings) {
  const state = vault.load();
  const total = games.length;
  const summary = { ok: 0, failed: 0, batches: 0, status: 0 };

  for (let i = 0; i < games.length; i += settings.batchSize) {
    summary.batches++;
    const chunk = games.slice(i, i + settings.batchSize);
    const events = [];
    for (const game of chunk) {
      for (const ev of buildEventsFor(game)) events.push(ev);
    }

    let status = 0;
    if (settings.dryRun) {
      status = 204;
    } else {
      try {
        const res = await fetch(ENDPOINTS.science, {
          method: "POST",
          headers: {
            accept: "*/*",
            "accept-language": CLIENT.locale,
            authorization: state.token,
            "content-type": "application/json",
            cookie: state.cookie,
            origin: "https://discord.com",
            referer: "https://discord.com/channels/@me",
            "user-agent": CLIENT.agent,
            "x-debug-options": "bugReporterEnabled",
            "x-discord-locale": CLIENT.locale,
            "x-discord-timezone": CLIENT.timezone,
            "x-super-properties": session.superProps,
          },
          body: JSON.stringify({ token: state.analyticsToken, events }),
        });
        status = res.status;
      } catch (_) {
        status = 0;
      }
    }

    if (status === 204) {
      summary.ok += chunk.length;
      info(`batch ${summary.batches} ${CH.dim}${BULLET}${CH.reset} ${summary.ok}/${total} forged`);
    } else if (status === 401 || status === 403) {
      fail(`batch ${summary.batches} ${CH.dim}${BULLET}${CH.reset} http ${status} auth rejected, re-mint the session (menu 2)`);
      summary.failed += chunk.length;
      break;
    } else {
      summary.failed += chunk.length;
      warn(`batch ${summary.batches} ${CH.dim}${BULLET}${CH.reset} http ${status || "network error"}`);
    }

    if (i + settings.batchSize < games.length) {
      await sleep(nextBatchPause(settings, summary.batches));
    }
  }

  summary.status = summary.ok === total ? 204 : 0;
  return summary;
}

function recordRun(summary, hoursEach, dry) {
  const state = vault.load();
  if (!dry) {
    state.totals.titles += summary.ok;
    state.totals.hours += summary.ok * hoursEach;
    state.totals.runs += 1;
    state.lastRun = {
      at: new Date().toISOString(),
      ok: summary.ok,
      failed: summary.failed,
      hoursEach,
    };
    vault.save();
  }
  journalAppend({
    ts: new Date().toISOString(),
    mode: dry ? "dry" : "live",
    ok: summary.ok,
    failed: summary.failed,
    batches: summary.batches,
    hoursEach,
    totalHours: summary.ok * hoursEach,
  });
}

module.exports = { runForges, recordRun, journalAppend };
