// app/hooks/useLanyard.ts
'use client';
import { useEffect, useRef, useState } from 'react';

// ─── Replace with your Discord snowflake ID ───────────────────────
export const DISCORD_USER_ID = '1023628644213587998';
// ──────────────────────────────────────────────────────────────────

export interface SpotifyData {
  song: string;
  artist: string;
  album: string;
  album_art_url: string;
  track_id: string;
  timestamps: { start: number; end: number };
}

export interface Activity {
  id: string;
  name: string;
  type: number; // 0=Game, 1=Streaming, 2=Listening, 3=Watching, 4=Custom, 5=Competing
  details?: string;
  state?: string;
  emoji?: { name: string; id?: string; animated?: boolean };
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
  timestamps?: { start?: number; end?: number };
  application_id?: string;
}

export interface LanyardData {
  discord_user: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    display_name?: string;
    global_name?: string;
  };
  discord_status: 'online' | 'idle' | 'dnd' | 'offline';
  activities: Activity[];
  listening_to_spotify: boolean;
  spotify: SpotifyData | null;
  active_on_discord_desktop: boolean;
  active_on_discord_mobile: boolean;
  active_on_discord_web: boolean;
}

type HookState =
  | { status: 'connecting' }
  | { status: 'connected'; data: LanyardData }
  | { status: 'error'; message: string };

const HEARTBEAT_INTERVAL = 30_000;
const RECONNECT_DELAY    = 5_000;

export function useLanyard(): HookState {
  const [state, setState] = useState<HookState>({ status: 'connecting' });
  const wsRef  = useRef<WebSocket | null>(null);
  const hbRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setState({ status: 'connecting' });

      const ws = new WebSocket('wss://api.lanyard.rest/socket');
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as {
          op: number;
          d?: unknown;
          t?: string;
        };

        if (msg.op === 1) {
          // Hello — start heartbeat & subscribe
          hbRef.current = setInterval(() => ws.send(JSON.stringify({ op: 3 })), HEARTBEAT_INTERVAL);
          ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: DISCORD_USER_ID } }));
        }

        if (msg.op === 0 && (msg.t === 'INIT_STATE' || msg.t === 'PRESENCE_UPDATE')) {
          setState({ status: 'connected', data: msg.d as LanyardData });
        }
      };

      ws.onclose = () => {
        if (hbRef.current) clearInterval(hbRef.current);
        if (!cancelled) setTimeout(connect, RECONNECT_DELAY);
      };

      ws.onerror = () => {
        setState({ status: 'error', message: 'WebSocket error' });
        ws.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (hbRef.current) clearInterval(hbRef.current);
      wsRef.current?.close();
    };
  }, []);

  return state;
}