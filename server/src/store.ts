import fs from 'fs';
import path from 'path';
import {RULES} from '../../shared/src/config';

export interface Member {name: string; t: number; w: Record<string, number>}
export interface League {code: string; name: string; members: Record<string, Member>}
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** League persistence: a JSON file (pass no file for in-memory, used by tests). */
export class Store {
  leagues = new Map<string, League>();
  private tm?: NodeJS.Timeout;
  constructor(private file?: string) {
    if (file && fs.existsSync(file)) {
      try { for (const l of JSON.parse(fs.readFileSync(file, 'utf8')) as League[]) this.leagues.set(l.code, l); } catch { /* start empty */ }
    }
  }
  private save() {
    if (!this.file) return;
    clearTimeout(this.tm);
    this.tm = setTimeout(() => {
      try { fs.mkdirSync(path.dirname(this.file!), {recursive: true}); fs.writeFileSync(this.file!, JSON.stringify([...this.leagues.values()])); } catch { /* ignore */ }
    }, 500);
  }
  create(name: string, pid: string, pname: string): League {
    let code = '';
    do code = Array.from({length: RULES.leagueCodeLength}, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join(''); while (this.leagues.has(code));
    const l: League = {code, name, members: {[pid]: {name: pname, t: 0, w: {}}}};
    this.leagues.set(code, l); this.save(); return l;
  }
  join(code: string, pid: string, pname: string): League | null {
    const l = this.leagues.get(code); if (!l) return null;
    l.members[pid] ??= {name: pname, t: 0, w: {}};
    l.members[pid].name = pname; this.save(); return l;
  }
  isMember(code: string, pid: string) { return !!this.leagues.get(code)?.members[pid]; }
  addWin(code: string, pid: string, mode: string) {
    const m = this.leagues.get(code)?.members[pid]; if (!m) return;
    m.w[mode] = (m.w[mode] || 0) + 1; m.t++; this.save();
  }
}
