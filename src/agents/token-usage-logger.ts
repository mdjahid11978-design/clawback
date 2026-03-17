import { homedir } from "node:os";
import { join } from "node:path";
import { requireNodeSqlite } from "../memory/sqlite.js";

type PreparedStatement = { run: (...args: unknown[]) => void };

let stmt: PreparedStatement | null = null;
let initialized = false;

function getStmt(): PreparedStatement | null {
  if (initialized) {
    return stmt;
  }
  initialized = true;
  try {
    const { DatabaseSync } = requireNodeSqlite();
    const dbPath = join(homedir(), ".openclaw", "workspace", "homelab.db");
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        session_key TEXT,
        model TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cache_read_tokens INTEGER,
        cache_creation_tokens INTEGER
      )
    `);
    stmt = db.prepare(
      `INSERT INTO token_usage (ts, session_key, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ) as unknown as PreparedStatement;
    return stmt;
  } catch {
    // DB unavailable — silently skip
    return null;
  }
}

export function logTokenUsage(opts: {
  sessionKey?: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}): void {
  try {
    const s = getStmt();
    if (!s) {
      return;
    }
    s.run(
      new Date().toISOString(),
      opts.sessionKey ?? null,
      opts.model ?? null,
      opts.inputTokens,
      opts.outputTokens,
      opts.cacheReadTokens,
      opts.cacheCreationTokens,
    );
  } catch {
    // Never throw from a logger
  }
}
