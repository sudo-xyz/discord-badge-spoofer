"use strict";

/**
 * number/duration formatting helpers.
 */

function int(n) {
  return Math.round(Number(n) || 0).toLocaleString("en-US");
}

function hours(h) {
  const v = Number(h) || 0;
  if (v >= 100000) return `${int(v)}h`;
  if (Number.isInteger(v)) return `${v}h`;
  return `${parseFloat(v.toFixed(2))}h`;
}

function msDuration(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hh = Math.floor((s % 86400) / 3600);
  const mm = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${hh}h`;
  if (hh) return `${hh}h ${mm}m`;
  return `${mm}m`;
}

function ago(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "unknown";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

module.exports = { int, hours, msDuration, ago };
