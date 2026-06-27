import type { Pool } from 'pg'
import type {
  SessionKey,
  SessionStore,
  SessionStoreEntry,
} from '@anthropic-ai/claude-agent-sdk'

export type PostgresSessionStoreOptions = {
  pool: Pool
  tableName?: string

  fixedProjectKey?: string
}

export class PostgresSessionStore implements SessionStore {
  private readonly pool: Pool
  private readonly table: string
  private readonly fixedProjectKey: string | undefined

  constructor(opts: PostgresSessionStoreOptions) {
    this.pool = opts.pool
    this.fixedProjectKey = opts.fixedProjectKey
    const t = opts.tableName ?? 'claude_session_entries'
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) {
      throw new Error(`invalid tableName: ${t}`)
    }
    this.table = t
  }

  private pk(key: SessionKey | string): string {
    return this.fixedProjectKey ?? (typeof key === 'string' ? key : key.projectKey)
  }

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        id          BIGSERIAL PRIMARY KEY,
        project_key TEXT NOT NULL,
        session_id  TEXT NOT NULL,
        subpath     TEXT,
        entry       JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS ${this.table}_key_idx
        ON ${this.table} (project_key, session_id, subpath, id)
    `)
  }

  async append(key: SessionKey, entries: SessionStoreEntry[]): Promise<void> {
    if (entries.length === 0) return

    const params: unknown[] = [
      this.pk(key), 
      key.sessionId,
      key.subpath ?? null,
    ]
    const rows = entries.map((e, i) => {
      params.push(JSON.stringify(e))
      return `($1,$2,$3,$${4 + i}::jsonb)`
    })
    await this.pool.query(
      `INSERT INTO ${this.table} (project_key, session_id, subpath, entry) VALUES ${rows.join(',')}`,
      params,
    )
  }

  async load(key: SessionKey): Promise<SessionStoreEntry[] | null> {
    const { rows } = await this.pool.query<{ entry: SessionStoreEntry }>(
      `SELECT entry FROM ${this.table}
         WHERE project_key = $1 AND session_id = $2 AND subpath IS NOT DISTINCT FROM $3
         ORDER BY id`,
      [this.pk(key), key.sessionId, key.subpath ?? null],
    )
    return rows.length > 0 ? rows.map((r: any) => r.entry) : null
  }

  async listSessions(
    projectKey: string,
  ): Promise<Array<{ sessionId: string; projectKey: string; mtime: number }>> {
    const { rows } = await this.pool.query<{ session_id: string; project_key: string; mtime: Date }>(
      `SELECT session_id, project_key, MAX(created_at) AS mtime FROM ${this.table}
         WHERE project_key = $1 AND subpath IS NULL
         GROUP BY session_id, project_key
         ORDER BY mtime DESC`,
      [this.pk(projectKey)],
    )
    return rows.map((r: any) => ({
      sessionId: r.session_id,
      projectKey: r.project_key,
      mtime: r.mtime.getTime(),
    }))
  }

  async listAllSessions(): Promise<Array<{ sessionId: string; projectKey: string; mtime: number }>> {
    const { rows } = await this.pool.query<{ session_id: string; project_key: string; mtime: Date }>(
      `SELECT session_id, project_key, MAX(created_at) AS mtime FROM ${this.table}
         WHERE subpath IS NULL
         GROUP BY session_id, project_key
         ORDER BY mtime DESC`
    )
    return rows.map((r: any) => ({
      sessionId: r.session_id,
      projectKey: r.project_key,
      mtime: r.mtime.getTime(),
    }))
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    if (this.fixedProjectKey) {
      await this.pool.query(
        `DELETE FROM ${this.table} WHERE project_key = $1 AND session_id = $2`,
        [this.fixedProjectKey, sessionId],
      )
    } else {
      await this.pool.query(
        `DELETE FROM ${this.table} WHERE session_id = $1`,
        [sessionId],
      )
    }
  }

  async delete(key: SessionKey): Promise<void> {
    if (key.subpath === undefined) {
      await this.pool.query(
        `DELETE FROM ${this.table} WHERE project_key = $1 AND session_id = $2`,
        [this.pk(key), key.sessionId],
      )
    } else {
      await this.pool.query(
        `DELETE FROM ${this.table} WHERE project_key = $1 AND session_id = $2 AND subpath = $3`,
        [this.pk(key), key.sessionId, key.subpath],
      )
    }
  }

  async listSubkeys(key: {
    projectKey: string
    sessionId: string
  }): Promise<string[]> {
    const { rows } = await this.pool.query<{ subpath: string }>(
      `SELECT DISTINCT subpath FROM ${this.table}
         WHERE project_key = $1 AND session_id = $2 AND subpath IS NOT NULL`,
      [this.pk(key.projectKey), key.sessionId],
    )
    return rows.map((r: any) => r.subpath)
  }
}