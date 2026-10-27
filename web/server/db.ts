import "server-only";
// Private report store, in SQLite. In production a hosted libSQL database (Turso) over HTTP, set by
// TURSO_DATABASE_URL and TURSO_AUTH_TOKEN; locally a file under .data/ (git-ignored) through node:sqlite.
// Everything here is confidential: never log row contents, never return rows without an access check.

import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { createClient, type Client, type Transaction } from "@libsql/client/web";

const FILE = process.env.SEHAT_DB_FILE || path.join(process.cwd(), ".data", "sehat.db");

const SCHEMA = `
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
  data        BLOB NOT NULL,               -- the file itself; never served without the report's access check
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

type Value = string | number | bigint | null | Uint8Array;

/** The queries the rest of the server uses, on the database or inside a transaction. */
export type Q = {
  get<T>(sql: string, ...args: Value[]): Promise<T | undefined>;
  all<T>(sql: string, ...args: Value[]): Promise<T[]>;
  run(sql: string, ...args: Value[]): Promise<void>;
};
type Store = { q: Q; tx<T>(fn: (q: Q) => Promise<T>): Promise<T> };

/** Hosted: libSQL over HTTP, with interactive write transactions. */
async function remote(url: string): Promise<Store> {
  const c = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  await c.executeMultiple(SCHEMA);
  const on = (x: Client | Transaction): Q => ({
    get: async <T,>(sql: string, ...args: Value[]) => (await x.execute({ sql, args })).rows[0] as unknown as T | undefined,
    all: async <T,>(sql: string, ...args: Value[]) => (await x.execute({ sql, args })).rows as unknown as T[],
    run: async (sql: string, ...args: Value[]) => void (await x.execute({ sql, args })),
  });
  return {
    q: on(c),
    async tx(fn) {
      const t = await c.transaction("write");
      try {
        const out = await fn(on(t));
        await t.commit();
        return out;
      } finally {
        t.close();
      }
    },
  };
}

/** Local: one SQLite file. Transactions run one at a time so no other request's statements land inside one. */
async function local(file: string): Promise<Store> {
  const { DatabaseSync } = await import("node:sqlite");
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const d: DatabaseSync = new DatabaseSync(file);
  d.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  d.exec(SCHEMA);
  const q: Q = {
    get: async <T,>(sql: string, ...args: Value[]) => d.prepare(sql).get(...args) as T | undefined,
    all: async <T,>(sql: string, ...args: Value[]) => d.prepare(sql).all(...args) as T[],
    run: async (sql: string, ...args: Value[]) => void d.prepare(sql).run(...args),
  };
  let queue: Promise<unknown> = Promise.resolve();
  return {
    q,
    tx(fn) {
      const run = queue.then(async () => {
        d.exec("BEGIN IMMEDIATE");
        try {
          const out = await fn(q);
          d.exec("COMMIT");
          return out;
        } catch (e) {
          d.exec("ROLLBACK");
          throw e;
        }
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}

const g = globalThis as unknown as { __sehatDb?: Promise<Store> };

function store(): Promise<Store> {
  g.__sehatDb ??= (process.env.TURSO_DATABASE_URL ? remote(process.env.TURSO_DATABASE_URL) : local(FILE)).catch((e) => {
    g.__sehatDb = undefined;
    throw e;
  });
  return g.__sehatDb;
}

/** The database, schema ensured. */
export async function db(): Promise<Q> {
  return (await store()).q;
}

export const now = () => Math.floor(Date.now() / 1000);

/** Runs fn in a write transaction. */
export async function tx<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  return (await store()).tx(fn);
}
