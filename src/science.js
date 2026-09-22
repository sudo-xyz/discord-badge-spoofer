"use strict";

/**
 * science event construction. builds launch_game + running_game_heartbeat
 * triplets from a session identity.
 */

const crypto = require("crypto");
const { CLIENT } = require("./config");
const vault = require("./vault");

let seq = 0;
let heartbeatSession = "";
let launchSignature = "";
let superPropsB64 = "";

function bindSession(hb, sig, props) {
  heartbeatSession = hb;
  launchSignature = sig;
  superPropsB64 = props;
  seq = 0;
}

function nextSeq() {
  return ++seq;
}

function buildLaunchEvent(game) {
  const now = Date.now();
  const state = vault.load();
  const props = {
    client_track_timestamp: now,
    client_heartbeat_session_id: heartbeatSession,
    event_sequence_number: nextSeq(),
    game: game.name,
    game_id: game.id,
    verified: true,
    elevated: false,
    is_launcher: false,
    game_platform: "desktop",
    detection_method: "verified_game",
    is_overlay_enabled: false,
    is_overlay_game_enabled: true,
    is_overlay_game_source: "OOP_DEFAULT_DATABASE",
    fullscreen_type: "UNKNOWN",
    hardware_display_count: 1,
    overlay_method: "Disabled",
    activity_status_enabled: true,
    activity_status_shared_guilds: [],
    current_user_status: "online",
    game_detection_enabled: true,
    executable_path: game.exe,
    voice_channel_id: null,
    voice_channel_type: null,
    voice_channel_bitrate: null,
    voice_channel_guild_id: null,
    hidden_by_distributor: false,
    game_metadata: null,
    executable_fingerprint: state.fingerprint || undefined,
    client_performance_cpu: null,
    client_performance_memory: null,
    cpu_core_count: null,
    accessibility_features: 0,
    rendered_locale: CLIENT.locale,
    launch_signature: launchSignature,
    client_rtc_state: null,
    client_app_state: "focused",
    client_send_timestamp: now,
  };
  if (!state.fingerprint) delete props.executable_fingerprint;
  return { type: "launch_game", properties: props };
}

function buildHeartbeatEvent(game, durationMs, sessionId, initial, final, ts = null) {
  const timestamp = ts === null ? Date.now() : ts;
  return {
    type: "running_game_heartbeat",
    properties: {
      client_track_timestamp: timestamp,
      client_heartbeat_session_id: heartbeatSession,
      event_sequence_number: nextSeq(),
      game_id: game.id,
      game_name: game.name,
      game_metadata: null,
      game_executable: game.exe,
      game_detection_enabled: true,
      initial_heartbeat: initial,
      final_heartbeat: final,
      game_session_id: sessionId,
      duration_tracked_ms: durationMs,
      rtc_connection_id: null,
      media_session_id: null,
      launch_signature: launchSignature,
      client_app_state: "focused",
      client_send_timestamp: timestamp,
    },
  };
}

function buildSessionTriplet(game, durationMs) {
  // open heartbeat (0ms) -> launch_game -> close heartbeat (full duration),
  // sharing one game_session_id, timestamps spanning the window.
  const sid = crypto.randomUUID();
  const now = Date.now();
  let start = now - durationMs;
  if (start < 0) start = now;
  return [
    buildHeartbeatEvent(game, 0, sid, true, false, start),
    buildLaunchEvent(game),
    buildHeartbeatEvent(game, durationMs, sid, false, true, now),
  ];
}

module.exports = { bindSession, nextSeq, buildLaunchEvent, buildHeartbeatEvent, buildSessionTriplet };
