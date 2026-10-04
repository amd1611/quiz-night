import {io, type Socket} from 'socket.io-client';
import type {LeagueView, Snapshot} from '@shared/types';

let pid = localStorage.getItem('qn_pid');
if (!pid) { pid = 'p' + Math.random().toString(36).slice(2, 12); localStorage.setItem('qn_pid', pid); }
export const myId: string = pid;

let sock: Socket | null = null;
export function connect(name: string, h: {state: (s: Snapshot | null) => void; league: (l: LeagueView) => void; status: (ok: boolean) => void}) {
  sock?.disconnect();
  sock = io({auth: {pid, name}});            // same origin; Vite proxies /socket.io in dev
  sock.on('state', h.state); sock.on('league', h.league);
  sock.on('connect', () => h.status(true)); sock.on('disconnect', () => h.status(false));
}
export const call = (ev: string, data: object = {}): Promise<any> =>
  new Promise(res => {
    if (!sock) return res({error: 'Offline'});
    sock.timeout(8000).emit(ev, data, (err: unknown, r: any) => res(err ? {error: 'No response from server'} : r));
  });
