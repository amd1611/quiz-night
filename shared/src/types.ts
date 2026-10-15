import type {ModeId} from './config';
export type PublicQ =
  | {kind: 'mcq'; meta: string; q: string; options: string[]}
  | {kind: 'jeo'; meta: string; q: string}
  | {kind: 'lingo'; first: string; len: number; tries: number}
  | {kind: 'wheel'; hint: string};
export interface MyView {
  answered: boolean; sel: number; correct: boolean | null; answer?: string; hide: number[]; ll: boolean;
  offer?: 'safe' | 'standard' | 'bold' | null;
  guesses: {w: string; c: string[]}[]; word?: string; ok: boolean | null;
  wheel?: {mask: string[]; sp: number | null; rs: number; bad: number; last: string; used: string};
}
export interface PlayerView {pid: string; name: string; ready: boolean; connected: boolean; score: number; out: boolean; answered: boolean; gap: number}
export interface Snapshot {
  code: string; solo: boolean; host: string; mode: ModeId; st: 'lobby' | 'play' | 'end';
  q: number; total: number; league: string; busy: boolean; ai: boolean; ms: number; players: PlayerView[]; question: PublicQ | null; me: MyView | null;
  aiNote?: string | null;
}
export interface LeagueView {
  code: string; name: string;
  members: {pid: string; name: string; t: number; w: Record<string, number>}[];
  party: {code: string; state: 'lobby' | 'play' | 'end'} | null;
}
