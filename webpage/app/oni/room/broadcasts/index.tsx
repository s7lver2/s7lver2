import type { FC } from 'react';
import type { Channel } from '../channels';
import Card, { paintCard } from './Card';

export interface BroadcastDef { Component: FC<{ channel: Channel }>; paint?: (ctx: CanvasRenderingContext2D, channel: Channel, t: number) => void }

// emisiones hechas en React; un canal las pide con { kind: 'component', id }
export const BROADCASTS: Record<string, BroadcastDef> = {
  card: { Component: Card, paint: paintCard },
};

export function broadcastFor(ch: Channel): BroadcastDef {
  return (ch.broadcast.kind === 'component' && BROADCASTS[ch.broadcast.id]) || BROADCASTS.card;
}
