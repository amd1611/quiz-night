import {io, type Socket} from 'socket.io-client';
import type {LeagueView, Snapshot} from '@shared/types';

export let myId = '';
let socket: Socket | null = null;

export function setMyId(id: string) {
  myId = id;
}

export function connect(handlers: {
  state: (snapshot: Snapshot | null) => void;
  league: (league: LeagueView) => void;
  status: (connected: boolean) => void;
}) {
  socket?.disconnect();
  socket = io({withCredentials: true, reconnection: true, reconnectionAttempts: Infinity});
  socket.on('state', handlers.state);
  socket.on('league', handlers.league);
  socket.on('connect', () => handlers.status(true));
  socket.on('disconnect', () => handlers.status(false));
  socket.on('connect_error', () => handlers.status(false));
}

export function disconnect() {
  socket?.disconnect();
  socket = null;
}

export const call = (event: string, data: object = {}, timeoutMs = 30000): Promise<any> =>
  new Promise(resolve => {
    if (!socket) return resolve({error: 'Not connected'});
    socket.timeout(timeoutMs).emit(event, data, (error: unknown, result: any) =>
      resolve(error ? {error: 'No response from the game server'} : result)
    );
  });
