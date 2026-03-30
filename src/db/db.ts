import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { SCHEMA_SQL } from "./schema.js";

export const DB_DIR = join(homedir(), ".claw-doing");
export const DB_PATH = join(DB_DIR, "claw-doing.db");

let _db: DatabaseSync | null = null;

function openDb(path: string): DatabaseSync {
  const dir = dirname(path);
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec(SCHEMA_SQL);
  return db;
}

/**
 * Override the active database instance (used in tests).
 * Pass a DatabaseSync opened at a custom path (e.g. ':memory:' or a temp file).
 */
export function setDb(db: DatabaseSync): void {
  _db = db;
}

export function getDb(): DatabaseSync {
  if (_db) return _db;
  _db = openDb(DB_PATH);
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export { openDb };
