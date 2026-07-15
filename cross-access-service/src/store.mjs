// Tiny JSON-file store for Stage 1 dummy data.
//
// This stands in for the Supabase Postgres tables it maps to 1:1:
//   users            -> registrations / profiles (subset)
//   cross_access_grants -> a dedicated grants table (source of truth for timed access)
//   revocation_log   -> an audit table of every worker action
//
// Node is single-threaded so the interval worker and HTTP handlers never race
// on the in-memory object; we persist to disk after each mutation.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

const EMPTY = { users: [], grants: [], log: [], meta: { lastSweepAt: null, sweeps: 0 } };

let state = structuredClone(EMPTY);

export function load() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      state = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
      state.meta ||= { lastSweepAt: null, sweeps: 0 };
    }
  } catch (err) {
    console.error("[store] failed to read store, starting empty:", err.message);
    state = structuredClone(EMPTY);
  }
  return state;
}

export function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2));
}

export function reset(seed) {
  state = seed ? structuredClone(seed) : structuredClone(EMPTY);
  save();
  return state;
}

export function db() {
  return state;
}

export function appendLog(entry) {
  state.log.unshift({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...entry });
  // keep the log bounded for the demo
  if (state.log.length > 200) state.log.length = 200;
}
