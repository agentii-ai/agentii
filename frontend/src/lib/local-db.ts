/**
 * Local SQLite wrapper for desktop offline mode.
 * Uses the same schema as Supabase PostgreSQL — only the connection changes.
 * In web mode, this module is a no-op (all queries go through Supabase).
 */

export interface LocalDB {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  execute(sql: string, params?: unknown[]): Promise<void>
  isAvailable(): boolean
}

class NoopDB implements LocalDB {
  async query<T>(): Promise<T[]> { return [] }
  async execute(): Promise<void> {}
  isAvailable(): boolean { return false }
}

class TauriSQLiteDB implements LocalDB {
  private db: unknown = null

  async init(): Promise<void> {
    try {
      // Dynamic import — only available in Tauri desktop
      const { default: Database } = await import('@tauri-apps/plugin-sql')
      this.db = await Database.load('sqlite:~/.agentii/projects.db')
    } catch {
      // Not in Tauri environment
      this.db = null
    }
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    if (!this.db) return []
    return (this.db as any).select(sql, params ?? [])
  }

  async execute(sql: string, params?: unknown[]): Promise<void> {
    if (!this.db) return
    await (this.db as any).execute(sql, params ?? [])
  }

  isAvailable(): boolean {
    return this.db !== null
  }
}

let instance: LocalDB | null = null

export async function getLocalDB(): Promise<LocalDB> {
  if (instance) return instance

  // Check if we're in Tauri
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    const db = new TauriSQLiteDB()
    await db.init()
    instance = db.isAvailable() ? db : new NoopDB()
  } else {
    instance = new NoopDB()
  }

  return instance
}

/** Schema migrations — same as Supabase PostgreSQL */
export const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    ticker_symbols TEXT DEFAULT '[]',
    project_type TEXT NOT NULL DEFAULT 'us_stock',
    description TEXT,
    is_featured INTEGER NOT NULL DEFAULT 0,
    is_template INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived_at TEXT,
    metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT,
    provider_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    message_count INTEGER NOT NULL DEFAULT 0,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS provider_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    is_validated INTEGER NOT NULL DEFAULT 0,
    validated_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, provider_name)
  )`,
]

export async function runMigrations(db: LocalDB): Promise<void> {
  for (const sql of MIGRATIONS) {
    await db.execute(sql)
  }
}
