// Wire format for GET /api/projects/graph. Shared between the route and the
// client so both sides agree on the shape. No logic lives here.
export type GraphNodeKind = 'project' | 'language';

export interface GraphNodeWire {
  id: string;
  kind: GraphNodeKind;
  color: string;
  /** Number of edges touching this node. Drives node radius. */
  degree: number;
  // Project-only fields:
  slug?: string;
  repo?: string | null;
  desc?: string;
  status?: 'done' | 'beta' | 'dev';
  /** Language name -> percentage of the repo, rounded. Projects only. */
  langs?: Record<string, number>;
}

export interface GraphLinkWire {
  source: string;
  target: string;
  /** Percentage of the project's bytes written in this language, rounded. */
  weight: number;
}

export interface GraphPayload {
  nodes: GraphNodeWire[];
  links: GraphLinkWire[];
  /** Unix ms when the upstream language data was fetched. */
  fetchedAt: number;
  /** True when language data came from cache because upstream failed. */
  stale?: boolean;
}
