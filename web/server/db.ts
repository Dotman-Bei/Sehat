import "server-only";
// Private report store. SQLite through node:sqlite (Node 22+), one file under .data/ (git-ignored).
// Everything here is confidential: never log row contents, never return rows without an access check.
// Swap this module for Postgres in production; the rest of the server talks to it through server/reports.ts.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const FILE = process.env.SEHAT_DB_FILE || path.join(process.cwd(), ".data", "sehat.db");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS reports (
  id            TEXT PRIMARY KEY,          -- random, used in private links
  ref           TEXT NOT NULL UNIQUE,      -- SHT-0001, for people
  chain_id      INTEGER NOT NULL,
  programme_id  INTEGER NOT NULL,
  reporter      TEXT NOT NULL,             -- lowercase wallet
  title         TEXT NOT NULL,
  category      TEXT NOT NULL,
  target        TEXT NOT NULL,
  suggested     TEXT NOT NULL,
  confirmed     TEXT,
  status        TEXT NOT NULL,
  reason        TEXT,
  reward        TEXT,                      -- agreed amount in BOT, decimal string
  impact        TEXT NOT NULL,
  steps         TEXT NOT NULL,
  payout_wallet TEXT NOT NULL,
  salt          TEXT NOT NULL,             -- never leaves the server
  digest        TEXT NOT NULL UNIQUE,      -- keccak256(abi.encode(ref, salt)); the only on-chain trace
  payout_tx     TEXT,
  payout_block  INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_by_reporter ON reports(reporter);
CREATE INDEX IF NOT EXISTS reports_by_programme ON reports(chain_id, programme_id);

CREATE TABLE IF NOT EXISTS report_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id  TEXT NOT NULL REFERENCES reports(id),
  status     TEXT NOT NULL,
  actor      TEXT NOT NULL,
  reason     TEXT,
  at         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id  TEXT NOT NULL REFERENCES reports(id),
  author     TEXT NOT NULL,                -- lowercase wallet
  role       TEXT NOT NULL,                -- researcher | team
  team_only  INTEGER NOT NULL DEFAULT 0,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (
  id          TEXT PRIMARY KEY,            -- random
  report_id   TEXT NOT NULL REFERENCES reports(id),
  name        TEXT NOT NULL,
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  file        TEXT NOT NULL,               -- path under .data/attachments
  uploaded_by TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS triagers (
  chain_id     INTEGER NOT NULL,
  programme_id INTEGER NOT NULL,
  wallet       TEXT NOT NULL,
  name         TEXT NOT NULL,
  added_by     TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (chain_id, programme_id, wallet)
);

CREATE TABLE IF NOT EXISTS nonces (
  nonce      TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS abuse (
  id          TEXT PRIMARY KEY,
  target_kind TEXT NOT NULL,              -- programme | report
  target      TEXT NOT NULL,
  reason      TEXT NOT NULL,
  reporter    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open', -- open | hidden | dismissed
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS hidden_programmes (
  chain_id     INTEGER NOT NULL,
  programme_id INTEGER NOT NULL,
  reason       TEXT NOT NULL,
  at           INTEGER NOT NULL,
  PRIMARY KEY (chain_id, programme_id)
);

CREATE TABLE IF NOT EXISTS audit (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     INTEGER NOT NULL,
  actor  TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS rate (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);
`;

const g = globalThis as unknown as { __sehatDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__sehatDb) {
    if (FILE !== ":memory:") mkdirSync(path.dirname(FILE), { recursive: true });
    const d = new DatabaseSync(FILE);
    d.exec(SCHEMA);
    g.__sehatDb = d;
  }
  return g.__sehatDb;
}

export const now = () => Math.floor(Date.now() / 1000);

/** Runs fn in a transaction. */
export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    d.exec("COMMIT");
    return out;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
