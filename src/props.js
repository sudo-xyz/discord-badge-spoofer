"use strict";

/**
 * super_props assembly: tries the cordapi mirror for fresh client properties,
 * falls back to local constants, then injects our session identifiers.
 */

const crypto = require("crypto");
const { CLIENT, ENDPOINTS } = require("./config");

function localProps() {
  return {
    os: "Windows",
    browser: "Discord Client",
    release_channel: "stable",
    client_version: CLIENT.release,
    os_version: CLIENT.osRelease,
    os_arch: "x64",
    app_arch: "x64",
    system_locale: CLIENT.locale,
    has_client_mods: false,
    browser_user_agent: CLIENT.agent,
    browser_version: CLIENT.electron,
    os_sdk_version: CLIENT.osRelease.split(".").pop(),
    client_build_number: CLIENT.build,
    native_build_number: CLIENT.nativeBuild,
    client_event_source: null,
    client_app_state: "focused",
  };
}

async function buildSuperProps(heartbeatSession, launchSignature) {
  let props;
  try {
    const res = await fetch(ENDPOINTS.props, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": CLIENT.agent },
      body: "{}",
    });
    const data = await res.json();
    props = data && data.properties;
    if (!props || typeof props !== "object") props = localProps();
  } catch (_) {
    props = localProps();
  }
  props.client_launch_id = crypto.randomUUID();
  props.launch_signature = launchSignature;
  props.client_heartbeat_session_id = heartbeatSession;
  return Buffer.from(JSON.stringify(props), "utf-8").toString("base64");
}

module.exports = { buildSuperProps, localProps };
