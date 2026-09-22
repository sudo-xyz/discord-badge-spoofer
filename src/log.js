"use strict";

/**
 * ansi styling + stamped log lines. everything the ui prints funnels through
 * these functions so the look stays consistent.
 */

const CH = {
  reset: "\x1b[0m",
  dim: "\x1b[90m",
  red: "\x1b[91m",
  green: "\x1b[92m",
  yellow: "\x1b[93m",
  white: "\x1b[97m",
  orange: "\x1b[38;5;208m",
  cyan: "\x1b[96m",
  bold: "\x1b[1m",
  inverse: "\x1b[7m",
};

const BULLET = "\u25aa"; // small square, distinct from the old dot separator

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${CH.dim}${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${CH.reset}`;
}

function out(line) {
  console.log(line);
}

function write(raw) {
  process.stdout.write(raw);
}

function tagged(tag, tagColor, msgColor, msg) {
  out(`  ${stamp()} ${CH.dim}[${tagColor}${tag}${CH.dim}]${CH.reset} ${msgColor}${msg}${CH.reset}`);
}

function pass(msg)    { tagged(" ok ", CH.green, CH.green, msg); }
function fail(msg)    { tagged(" !! ", CH.red, CH.red, msg); }
function warn(msg)    { tagged(" ~! ", CH.yellow, CH.yellow, msg); }
function info(msg)    { tagged(" -> ", CH.cyan, CH.white, msg); }
function dim(msg)     { out(`  ${CH.dim}${msg}${CH.reset}`); }
function plain(msg)   { out(`  ${msg}`); }
function blank()      { out(""); }

function heading(text) {
  out(`  ${CH.bold}${CH.white}${text}${CH.reset}`);
}

function keyValue(key, value, keyColor = CH.orange) {
  plain(`${keyColor}${key}${CH.reset} ${CH.dim}\u2192${CH.reset} ${CH.white}${value}${CH.reset}`);
}

function line(char = "\u2500", width = 46) {
  out(`  ${CH.dim}${char.repeat(width)}${CH.reset}`);
}

function clear() {
  process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
}

function pause(msg = "press enter to go back") {
  return uiQuestion(`  ${CH.dim}${msg}${CH.reset}`);
}

function uiQuestion(question) {
  // note: lazily required to dodge a circular import (ui <-> log)
  const { ask } = require("./ui");
  return ask(question);
}

module.exports = {
  CH, BULLET,
  out, write, pass, fail, warn, info, dim, plain, blank,
  heading, keyValue, line, clear, stamp, pause,
};
