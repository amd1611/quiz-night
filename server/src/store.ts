import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {RULES} from '../../shared/src/config';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
}

export interface Member {
  name: string;
  t: number;
  w: Record<string, number>;
}

export interface League {
  code: string;
  name: string;
  members: Record<string, Member>;
}

const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const userKey = (value: string) => value.trim().toLocaleLowerCase('en-US');

/**
 * In-memory cache for live game state, backed by Postgres when DATABASE_URL is set.
 * Local development remains zero-setup; Render gets durable accounts and league records.
 */
export class Store {
  readonly leagues = new Map<string, League>();
  readonly usersById = new Map<string, User>();
  private readonly usersByName = new Map<string, User>();
  private readonly pool?: Pool;
  private pendingWrites: Promise<void> = Promise.resolve();

  constructor(databaseUrl = process.env.DATABASE_URL) {
    if (databaseUrl) {
      this.pool = new Pool({connectionString: databaseUrl, max: 5});
    }
  }

  get databaseEnabled() {
    return !!this.pool;
  }

  async init() {
    if (!this.pool) return;

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        username_key TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS leagues (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS league_members (
        league_code TEXT NOT NULL REFERENCES leagues(code) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        total_wins INTEGER NOT NULL DEFAULT 0,
        win_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (league_code, user_id)
      );
      CREATE INDEX IF NOT EXISTS league_members_user_idx ON league_members(user_id);
    `);

    const users = await this.pool.query<{id: string; username: string; password_hash: string}>(
      'SELECT id, username, password_hash FROM users'
    );
    for (const row of users.rows) {
      const user = {id: row.id, username: row.username, passwordHash: row.password_hash};
      this.usersById.set(user.id, user);
      this.usersByName.set(userKey(user.username), user);
    }

    const leagues = await this.pool.query<{code: string; name: string}>(
      'SELECT code, name FROM leagues ORDER BY created_at'
    );
    for (const row of leagues.rows) this.leagues.set(row.code, {code: row.code, name: row.name, members: {}});

    const members = await this.pool.query<{
      league_code: string;
      user_id: string;
      username: string;
      total_wins: number;
      win_counts: Record<string, number>;
    }>(`
      SELECT league_code, user_id, username, total_wins, win_counts
      FROM league_members
      ORDER BY total_wins DESC, joined_at ASC
    `);
    for (const row of members.rows) {
      const league = this.leagues.get(row.league_code);
      if (!league) continue;
      league.members[row.user_id] = {
        name: row.username,
        t: Number(row.total_wins),
        w: row.win_counts || {},
      };
    }
  }

  async close() {
    await this.flush();
    await this.pool?.end();
  }

  async createUser(username: string, passwordHash: string): Promise<User> {
    const clean = username.trim();
    const key = userKey(clean);
    if (this.usersByName.has(key)) throw new Error('USERNAME_TAKEN');

    const user: User = {id: randomUUID(), username: clean, passwordHash};
    if (this.pool) {
      try {
        await this.pool.query(
          'INSERT INTO users (id, username, username_key, password_hash) VALUES ($1, $2, $3, $4)',
          [user.id, user.username, key, user.passwordHash]
        );
      } catch (error: any) {
        if (error?.code === '23505') throw new Error('USERNAME_TAKEN');
        throw error;
      }
    }
    this.usersById.set(user.id, user);
    this.usersByName.set(key, user);
    return user;
  }

  findUser(username: string) {
    return this.usersByName.get(userKey(username)) ?? null;
  }

  findUserById(id: string) {
    return this.usersById.get(id) ?? null;
  }

  listFor(pid: string) {
    return [...this.leagues.values()]
      .filter(league => league.members[pid])
      .map(({code, name}) => ({code, name}));
  }

  create(name: string, pid: string, pname: string): League {
    let code = '';
    do {
      code = Array.from({length: RULES.leagueCodeLength}, () =>
        ALPHA[Math.floor(Math.random() * ALPHA.length)]
      ).join('');
    } while (this.leagues.has(code));

    const league: League = {
      code,
      name,
      members: {[pid]: {name: pname, t: 0, w: {}}},
    };
    this.leagues.set(code, league);
    this.persistLeague(league);
    return league;
  }

  join(code: string, pid: string, pname: string): League | null {
    const league = this.leagues.get(code);
    if (!league) return null;
    league.members[pid] ??= {name: pname, t: 0, w: {}};
    this.persistLeague(league);
    return league;
  }

  isMember(code: string, pid: string) {
    return !!this.leagues.get(code)?.members[pid];
  }

  addWin(code: string, pid: string, mode: string) {
    const member = this.leagues.get(code)?.members[pid];
    if (!member) return;
    member.w[mode] = (member.w[mode] || 0) + 1;
    member.t++;
    this.persistLeague(this.leagues.get(code)!);
  }

  async flush() {
    await this.pendingWrites;
  }

  private persistLeague(league: League) {
    if (!this.pool) return;
    const snapshot = structuredClone(league);
    this.pendingWrites = this.pendingWrites.then(async () => {
      const client = await this.pool!.connect();
      try {
        await client.query('BEGIN');
        const owner = Object.keys(snapshot.members)[0];
        await client.query(
          'INSERT INTO leagues (code, name, created_by) VALUES ($1, $2, $3) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name',
          [snapshot.code, snapshot.name, owner]
        );
        for (const [userId, member] of Object.entries(snapshot.members)) {
          await client.query(`
            INSERT INTO league_members (league_code, user_id, username, total_wins, win_counts)
            VALUES ($1, $2, $3, $4, $5::jsonb)
            ON CONFLICT (league_code, user_id)
            DO UPDATE SET username = EXCLUDED.username, total_wins = EXCLUDED.total_wins, win_counts = EXCLUDED.win_counts
          `, [snapshot.code, userId, member.name, member.t, JSON.stringify(member.w)]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Could not save league progress:', error instanceof Error ? error.message : 'database error');
      } finally {
        client.release();
      }
    });
  }
}
