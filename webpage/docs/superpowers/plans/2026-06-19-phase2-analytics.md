# Fase 2: Analytics de visitas + auth mínima — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar visitas al portfolio y exponer un dashboard de analytics protegido por login, replicando el patrón del linktree con storage Redis/JSON.

**Architecture:** Capa de storage dual (Upstash Redis o JSON local). Tracking client-side (`TrackingBeacon`) → `POST /api/tracking`. Auth mínima de root con token HMAC en cookie httpOnly. Dashboard en `/admin` (overview, traffic, live) con datos de `computeStats` y SSE para tiempo real. Lenguaje visual morado/azul del portfolio.

**Tech Stack:** Next.js 14.1, TypeScript, Tailwind 3.3, React 18, `@upstash/redis`, `recharts@^2`, `bcryptjs`.

**Reference:** El proyecto `E:\linktree` contiene una implementación funcional de TODO esto (con tema rojo y multiusuario). Varias tareas consisten en **portar** archivos concretos de ahí, adaptando: (a) el tema visual a morado/azul, (b) los modelos a los de la spec §3, (c) quitando lo multiusuario (eso es Fase 3). Rutas de referencia citadas por tarea.

## Global Constraints

- Storage agnóstico: funciona con FS (dev) y Upstash Redis (prod) según env vars.
- Tema del panel: dark + glassmorphism **morado `#8b5cf6` / azul `#3b82f6`** (NO el rojo del linktree). Reutilizar `.card-glass` / `.card-hover` de Fase 1.
- No tocar nada de Fase 3 (CRUD usuarios, OTP, WebAuthn, audit, página users/account).
- Auth de Fase 2 = solo root desde `ROOT_PASSWORD ?? ADMIN_PASSWORD`. Las firmas `createSessionToken`/`getSession`/`hashPassword`/`verifyPassword` deben ser extensibles para Fase 3.
- Cookie de sesión: `admin_session`, httpOnly, sameSite=lax, secure en prod, maxAge 7 días. Secret de `ADMIN_SECRET`.
- Geo: ip-api.com con timeout 2s + fallback a headers `x-vercel-ip-*`. Sin dependencia npm para geo.
- Trim de visitas a 10.000. Bots marcados y excluidos de las stats principales.
- Respetar `settings.trackingEnabled`.
- Gate por tarea (sin test runner): `npm run build` + verificación manual descrita. Un commit por tarea.

---

## File Structure

**Nuevos**
- `app/lib/redis.ts` — storage dual.
- `app/lib/auth.ts` — sesión root mínima.
- `app/lib/settings.ts` — settings (`trackingEnabled`).
- `app/lib/data.ts` — `Visit`, `Stats`, `parseUA`, `detectBot`, `addVisit`, `readVisits`, `computeStats`.
- `app/lib/presence.ts` — sesiones online.
- `app/components/TrackingBeacon.tsx` — cliente de tracking.
- `app/api/tracking/route.ts` — ingest de visitas.
- `app/api/admin/auth/route.ts` — login/logout root.
- `app/api/admin/stats/route.ts` — snapshot de stats.
- `app/api/admin/stream/route.ts` — SSE live.
- `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/login/page.tsx`, `app/admin/traffic/page.tsx`, `app/admin/live/page.tsx`.
- `app/admin/components/AdminSidebar.tsx`, `KPICard.tsx`, `DonutChart.tsx`.

**Modificados**
- `app/layout.tsx`, `package.json`, `.env.example`.

---

## Task 1: Dependencias + storage dual (`lib/redis.ts`)

**Files:** Modify `package.json`; Create `app/lib/redis.ts`.

**Interfaces:**
- Produces: helpers de storage consumidos por todas las libs siguientes. Firmas mínimas:
  ```ts
  export function useKV(): boolean;
  export async function kvGetJSON<T>(key: string, fallbackFile: string, def: T): Promise<T>;
  export async function kvSetJSON<T>(key: string, fallbackFile: string, value: T): Promise<void>;
  ```
  (El linktree usa helpers más granulares; para Fase 2 basta este par genérico key↔archivo, con listas serializadas como JSON. Si portas el `redis.ts` del linktree, mantén además sus helpers, pero EXPÓN al menos estas dos firmas para el resto del plan.)

- [ ] **Step 1: Añadir dependencias**

```bash
npm install @upstash/redis@^1.37.0 recharts@^2.12.0 bcryptjs@^3.0.3
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Crear `app/lib/redis.ts`**

Portar de `E:\linktree\app\lib\redis.ts` la lógica de decisión Upstash vs FS. Adaptar el prefijo de claves a `s7lver:` (en vez de `reokiy:`) y la carpeta local a `data/`. Implementar al menos:

```ts
import { Redis } from '@upstash/redis';
import { promises as fs } from 'fs';
import path from 'path';

const URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export function useKV() { return Boolean(URL && TOKEN); }

const redis = useKV() ? new Redis({ url: URL!, token: TOKEN! }) : null;

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'data');

async function readFile<T>(file: string, def: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), 'utf8')) as T; }
  catch { return def; }
}
async function writeFile<T>(file: string, value: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(value), 'utf8');
}

export async function kvGetJSON<T>(key: string, file: string, def: T): Promise<T> {
  if (redis) { const v = await redis.get<T>(key); return (v ?? def); }
  return readFile<T>(file, def);
}
export async function kvSetJSON<T>(key: string, file: string, value: T): Promise<void> {
  if (redis) { await redis.set(key, value); return; }
  await writeFile<T>(file, value);
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: OK (las libs aún no se usan, pero compila y los tipos son válidos).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app/lib/redis.ts
git commit -m "feat(admin): add dependencies and dual KV/FS storage layer"
```

---

## Task 2: Auth mínima (`lib/auth.ts`) + `lib/settings.ts`

**Files:** Create `app/lib/auth.ts`, `app/lib/settings.ts`.

**Interfaces:**
- Consumes: `kvGetJSON`/`kvSetJSON` (Task 1).
- Produces (consumido por route handlers y Fase 3):
  ```ts
  export interface SessionPayload { uid: string; u: string; r: 'root'|'user'; p: string[]|'all'; setup?: boolean; iat: number }
  export function createSessionToken(payload: Omit<SessionPayload,'iat'>, secret: string): string;
  export async function getSession(req?: Request): Promise<SessionPayload | null>;
  export async function hashPassword(plain: string): Promise<string>;
  export async function verifyPassword(plain: string, hash: string): Promise<{ ok: boolean; needsUpgrade: boolean }>;
  export const COOKIE_NAME: string; // 'admin_session'
  export function getSecret(): string; // ADMIN_SECRET ?? dev fallback
  ```
  ```ts
  // settings.ts
  export interface SiteSettings { trackingEnabled: boolean; updatedAt: string }
  export async function getSettings(): Promise<SiteSettings>;
  export async function updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings>;
  ```

- [ ] **Step 1: Crear `app/lib/auth.ts`**

Portar de `E:\linktree\app\lib\auth.ts` (createSessionToken/getSession/hashPassword/verifyPassword con HMAC-SHA256 base64url + bcrypt). Mantener firmas de arriba. Cookie name `admin_session`. Secret: `process.env.ADMIN_SECRET ?? 's7lver_dev_secret_change_me'`. Usar `next/headers` `cookies()` para leer la cookie cuando no se pasa `req`. NO incluir lógica multiusuario.

- [ ] **Step 2: Crear `app/lib/settings.ts`**

```ts
import { kvGetJSON, kvSetJSON } from './redis';

export interface SiteSettings { trackingEnabled: boolean; updatedAt: string }
const DEFAULT: SiteSettings = { trackingEnabled: true, updatedAt: new Date(0).toISOString() };
const KEY = 's7lver:settings';
const FILE = 'settings.json';

export async function getSettings(): Promise<SiteSettings> {
  return kvGetJSON<SiteSettings>(KEY, FILE, DEFAULT);
}
export async function updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const cur = await getSettings();
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  await kvSetJSON(KEY, FILE, next);
  return next;
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add app/lib/auth.ts app/lib/settings.ts
git commit -m "feat(admin): add minimal root session auth and settings store"
```

---

## Task 3: Capa de datos de visitas (`lib/data.ts`)

**Files:** Create `app/lib/data.ts`.

**Interfaces:**
- Consumes: `kvGetJSON`/`kvSetJSON` (Task 1).
- Produces:
  ```ts
  export interface Visit { /* ver spec §3 */ }
  export interface Stats { /* ver spec §3 */ }
  export function parseUA(ua: string): { browser: string; os: string; device: 'desktop'|'mobile'|'tablet' };
  export function detectBot(ua: string, headers: Headers): { isBot: boolean; reason?: string };
  export async function addVisit(v: Visit): Promise<void>;
  export async function readVisits(limit?: number): Promise<Visit[]>;
  export function computeStats(visits: Visit[]): Stats;
  ```

- [ ] **Step 1: Crear `app/lib/data.ts`**

Portar de `E:\linktree\app\lib\data.ts`:
- `parseUA` y `detectBot` (patrones UA + headers) tal cual.
- `Visit`/`Stats` adaptados EXACTAMENTE a la spec §3 (campos y nombres).
- `addVisit`: lee lista, hace unshift, trim a 10.000, persiste vía `kvSetJSON('s7lver:visits','visits.json', list)`.
- `readVisits(limit)`: lee la lista (slice).
- `computeStats(visits)`: filtra bots; calcula `totalVisits`, `uniqueVisitors` (IPs/sessionId únicos), `activeLastHour`, `bounceRate`, `avgSessionDuration`, `series7d`, `topPages/topCountries/topReferrers/browsers/devices`, `byDayHour` [7][24], `recentSessions`. Reutilizar la lógica del linktree, mapeando a los nombres de la spec.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add app/lib/data.ts
git commit -m "feat(admin): add visit data layer and stats computation"
```

---

## Task 4: Presencia (`lib/presence.ts`)

**Files:** Create `app/lib/presence.ts`.

**Interfaces:**
- Produces:
  ```ts
  export interface PresenceEntry { sessionId: string; lastSeen: number; connectedAt: number; page: string; country?: string; countryCode?: string; city?: string; lat?: number; lon?: number }
  export async function touchPresence(sessionId: string, info: Partial<PresenceEntry>): Promise<void>;
  export async function dropPresence(sessionId: string): Promise<void>;
  export async function getOnlineSessions(): Promise<PresenceEntry[]>;
  ```

- [ ] **Step 1: Crear `app/lib/presence.ts`**

Portar de `E:\linktree\app\lib\presence.ts`. TTL online 40.000 ms, prune 600.000 ms. Storage `s7lver:presence` / `presence.json`. `getOnlineSessions` filtra por `lastSeen > now - 40s` y poda los > 10min.

- [ ] **Step 2: Build + Commit**

Run: `npm run build` → OK.
```bash
git add app/lib/presence.ts
git commit -m "feat(admin): add online presence tracking"
```

---

## Task 5: Tracking endpoint + beacon

**Files:** Create `app/api/tracking/route.ts`, `app/components/TrackingBeacon.tsx`; Modify `app/layout.tsx`.

**Interfaces:**
- Consumes: `addVisit`, `parseUA`, `detectBot` (Task 3), `touchPresence`/`dropPresence` (Task 4), `getSettings` (Task 2).
- Produces: `POST /api/tracking` que acepta `{ type?: 'pageview'|'heartbeat'|'leave'; page: string; referrer?: string; sessionId?: string; duration?: number }`.

- [ ] **Step 1: Crear `app/api/tracking/route.ts`**

Portar de `E:\linktree\app\api\tracking\route.ts`. Lógica:
- Si `!settings.trackingEnabled` → `new Response(null, { status: 204 })`.
- IP real: helper `getTrueClientIp(req)` (headers `x-forwarded-for`, `x-real-ip`). Portar del linktree (`lib/settings.ts` lo tiene; inclúyelo aquí o en `lib/data.ts`).
- `detectBot(ua, req.headers)`.
- Geo: intentar headers Vercel (`x-vercel-ip-country`, `-city`, `-latitude`, `-longitude`); si faltan y no es local, `fetch('http://ip-api.com/json/<ip>?fields=...')` con `AbortController` timeout 2s. Tolerar fallo.
- `type==='leave'` → `dropPresence(sessionId)` y actualizar `duration` de la última visita de esa sesión; responder 204.
- `type==='heartbeat'` → `touchPresence`; responder 204.
- `pageview` → construir `Visit`, `addVisit`, `touchPresence`; setear cookie `sid` si no existía; responder `{ ok: true, sessionId }`.

- [ ] **Step 2: Crear `app/components/TrackingBeacon.tsx`**

Portar de `E:\linktree\app\components\TrackingBeacon.tsx`. Cliente: al montar envía pageview; heartbeat cada 15s; en `pagehide`/`visibilitychange==='hidden'` usa `navigator.sendBeacon('/api/tracking', JSON.stringify({type:'leave',...}))`. Gestiona `sessionId` (cookie `sid` o `localStorage`). Calcula `duration` desde el montaje.

- [ ] **Step 3: Montar en `app/layout.tsx`**

Importar y renderizar `<TrackingBeacon />` dentro del `<body>` (después de children o antes del cierre). Es client component; el layout puede seguir siendo server component montándolo como hijo.

- [ ] **Step 4: Build + smoke**

Run: `npm run build` → OK.
En `npm run dev`: cargar la home, comprobar en Network un `POST /api/tracking` con 200; recargar varias veces; verificar que `data/visits.json` se crea y crece.

- [ ] **Step 5: Commit**

```bash
git add app/api/tracking/route.ts app/components/TrackingBeacon.tsx app/layout.tsx
git commit -m "feat(admin): add visit tracking beacon and ingest endpoint"
```

---

## Task 6: Login de root + APIs de stats/stream

**Files:** Create `app/api/admin/auth/route.ts`, `app/api/admin/stats/route.ts`, `app/api/admin/stream/route.ts`.

**Interfaces:**
- Consumes: `getSession`/`createSessionToken`/`verifyPassword`/`hashPassword`/`COOKIE_NAME`/`getSecret` (Task 2), `readVisits`/`computeStats` (Task 3), `getOnlineSessions` (Task 4).
- Produces: `POST/DELETE /api/admin/auth`, `GET /api/admin/stats`, `GET /api/admin/stream` (SSE).

- [ ] **Step 1: `app/api/admin/auth/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { createSessionToken, getSecret, COOKIE_NAME } from '@/lib/auth';
import bcrypt from 'bcryptjs';

const ROOT_PW = process.env.ROOT_PASSWORD ?? process.env.ADMIN_PASSWORD ?? 's7lver_admin';

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  const ok = typeof password === 'string' && password.length > 0 && password === ROOT_PW;
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // slow brute force
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  const token = createSessionToken({ uid: 'root', u: 'root', r: 'root', p: 'all' }, getSecret());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return res;
}
```
(Nota: `bcrypt` import queda disponible para Fase 3; el login root compara contra env directamente.)

- [ ] **Step 2: `app/api/admin/stats/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readVisits, computeStats } from '@/lib/data';

export async function GET(req: Request) {
  const session = await getSession(req);
  if (!session || session.setup) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const visits = await readVisits();
  return NextResponse.json(computeStats(visits));
}
```

- [ ] **Step 3: `app/api/admin/stream/route.ts`**

Portar el patrón SSE de `E:\linktree\app\api\admin\stream\route.ts`. Guard con `getSession`. `ReadableStream` que cada 3s emite `data: ${JSON.stringify({ activeLastHour, todayTotal, recent, online, events, ts })}\n\n`. `recent` de `readVisits` (últimas 8 con coords); `online` de `getOnlineSessions`. Headers `text/event-stream`, `no-cache`, `keep-alive`. Limpiar el intervalo en `cancel()`.

- [ ] **Step 4: Build + smoke**

Run: `npm run build` → OK.
En dev: `POST /api/admin/auth` con password correcta → 200 + cookie; con incorrecta → 401. Con cookie, `GET /api/admin/stats` → JSON Stats; sin cookie → 401.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/auth/route.ts app/api/admin/stats/route.ts app/api/admin/stream/route.ts
git commit -m "feat(admin): add root login and stats/stream endpoints"
```

---

## Task 7: Layout, sidebar y login UI

**Files:** Create `app/admin/layout.tsx`, `app/admin/login/page.tsx`, `app/admin/components/AdminSidebar.tsx`.

**Interfaces:**
- Consumes: `/api/admin/auth`, `/api/admin/stream`.
- Produces: shell de `/admin` (sidebar + main), página de login.

- [ ] **Step 1: `app/admin/layout.tsx`**

Layout client-aware: si `usePathname() === '/admin/login'`, render `children` sin chrome; si no, `<div className="flex"><AdminSidebar/><main className="...">{children}</main></div>`. Fondo negro, tema morado/azul.

- [ ] **Step 2: `app/admin/login/page.tsx`**

Formulario de password (sin WebAuthn ni setup — Fase 3). `POST /api/admin/auth { password }`. En éxito → `router.push('/admin')`. Estilo: tarjeta `.card-glass` centrada, acento morado, mismo lenguaje del portfolio. Mostrar error en credenciales inválidas.

- [ ] **Step 3: `app/admin/components/AdminSidebar.tsx`**

Sidebar 200px, dark, glass. Nav: Overview (`/admin`), Traffic (`/admin/traffic`), Live (`/admin/live`) con item activo en morado (usar `usePathname`). Footer: indicador live (suscrito a `/api/admin/stream`: "N active · M today") + botón Logout (`DELETE /api/admin/auth` → redirect `/admin/login`). Portar la estructura del `AdminSidebar` del linktree pero recortada a estas 3 entradas y re-temada a morado.

- [ ] **Step 4: Build + manual**

Run: `npm run build` → OK.
En dev: `/admin/login` muestra el formulario; login correcto entra a `/admin` (aunque la página esté vacía aún); sidebar visible con las 3 entradas; logout vuelve a login.

- [ ] **Step 5: Commit**

```bash
git add app/admin/layout.tsx app/admin/login/page.tsx app/admin/components/AdminSidebar.tsx
git commit -m "feat(admin): add admin shell, sidebar and login page"
```

---

## Task 8: Componentes de gráficos (KPICard, DonutChart)

**Files:** Create `app/admin/components/KPICard.tsx`, `app/admin/components/DonutChart.tsx`.

**Interfaces:**
- Produces:
  ```ts
  // KPICard
  interface KPICardProps { label: string; value: string|number; delta?: number; sparkData?: number[]; sub?: string; accent?: boolean }
  // DonutChart
  interface DonutSlice { label: string; value: number; color: string }
  interface DonutProps { slices: DonutSlice[]; size?: number; thickness?: number; centerLabel?: { value: string|number; sub: string } }
  ```

- [ ] **Step 1: `KPICard.tsx`**

Portar de `E:\linktree\app\admin\components\KPICard.tsx`. Re-temar: número grande, delta verde/rojo, sparkline SVG opcional. Acento morado en vez de rojo (`accent` usa `--primary-purple`).

- [ ] **Step 2: `DonutChart.tsx`**

Portar de `E:\linktree\app\admin\components\DonutChart.tsx`. SVG donut con `stroke-dasharray`, label central opcional, % automático.

- [ ] **Step 3: Build + Commit**

Run: `npm run build` → OK.
```bash
git add app/admin/components/KPICard.tsx app/admin/components/DonutChart.tsx
git commit -m "feat(admin): add KPICard and DonutChart components"
```

---

## Task 9: Dashboard overview (`/admin`)

**Files:** Create `app/admin/page.tsx`.

**Interfaces:**
- Consumes: `GET /api/admin/stats` (forma `Stats`), `KPICard`, `DonutChart`, `recharts`.

- [ ] **Step 1: `app/admin/page.tsx`**

Client component. `useEffect` fetch `/api/admin/stats` cada 12s (si 401 → `router.push('/admin/login')`). Render:
- Fila de KPIs: Total visits (delta vs ayer, sparkline `series7d`), Unique visitors, Active 1h, Bounce rate, Avg session.
- Grid 2 col: `AreaChart` de `series7d` (recharts) + `DonutChart` de `devices`.
- Grid: Top pages, Top countries (con banderas via emoji por `code`), Top referrers, Browsers — como barras.
- Tabla "Recent sessions" (`recentSessions`).
Estilo morado/azul, `.card-glass`/`.card-hover`. Adaptar de `E:\linktree\app\admin\page.tsx` (quitando raffles/codes, que son del linktree).

- [ ] **Step 2: Build + manual**

Run: `npm run build` → OK.
En dev (tras generar visitas navegando la home): `/admin` muestra KPIs y gráficos con datos reales; auto-refresca.

- [ ] **Step 3: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): add analytics overview dashboard"
```

---

## Task 10: Traffic (`/admin/traffic`)

**Files:** Create `app/admin/traffic/page.tsx`.

- [ ] **Step 1: `app/admin/traffic/page.tsx`**

Client component, fetch `/api/admin/stats` cada 15s. Render:
- Heatmap 7×24 de `byDayHour` (celdas con opacidad según intensidad, acento morado).
- Funnel/lista de top pages.
- Donut + tabla de referrers.
Adaptar de `E:\linktree\app\admin\traffic\page.tsx`.

- [ ] **Step 2: Build + Commit**

Run: `npm run build` → OK.
```bash
git add app/admin/traffic/page.tsx
git commit -m "feat(admin): add traffic page with day-hour heatmap"
```

---

## Task 11: Live (`/admin/live`) + docs/verificación

**Files:** Create `app/admin/live/page.tsx`; Modify `.env.example`, `README.md`.

- [ ] **Step 1: `app/admin/live/page.tsx`**

Client component. `EventSource('/api/admin/stream')`. Render:
- Pills de stats: online count, active 1h, today total.
- "Online now": lista de sesiones con país/ciudad/página.
- Feed en vivo: últimos ~30 eventos (visit/connect/disconnect).
- (Mapa D3 completo = mejora futura/Fase 3; en Fase 2 basta la lista geolocalizada.)
Adaptar de `E:\linktree\app\admin\live\page.tsx` sin el WorldMapV2.

- [ ] **Step 2: `.env.example` + `README.md`**

Añadir a `.env.example`:
```
# Admin auth (Phase 2)
ADMIN_SECRET=change_me_to_a_long_random_string
ROOT_PASSWORD=change_me
# Storage (optional; without these, data is stored as local JSON / /tmp on Vercel)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
# Live map server location (optional)
NEXT_PUBLIC_SERVER_LAT=39.5
NEXT_PUBLIC_SERVER_LON=-98.35
```
README: documentar `/admin`, login con `ROOT_PASSWORD`, que sin Redis los datos son efímeros en Vercel, y el toggle `trackingEnabled`.

- [ ] **Step 3: Build + verificación integral**

Run: `npm run build` → OK.
Checklist en dev:
- Navegar la home varias veces genera visitas.
- `/admin/login` con `ROOT_PASSWORD` entra; sin sesión, `/admin` redirige a login.
- `/admin` muestra KPIs/gráficos reales; `/admin/traffic` muestra heatmap; `/admin/live` muestra sesiones online vía SSE.
- Tema morado/azul consistente.
- Funciona sin Redis (FS).

- [ ] **Step 4: Commit**

```bash
git add app/admin/live/page.tsx .env.example README.md
git commit -m "feat(admin): add live page; document Phase 2 env and usage"
```

---

## Self-Review (cobertura de la spec)

- §1 storage dual → Task 1. ✅
- §1 auth mínima → Tasks 2, 6, 7. ✅
- §1 tracking → Tasks 3, 5. ✅
- §1 data layer / computeStats → Task 3. ✅
- §1 presencia → Task 4. ✅
- §1 APIs stats/stream → Task 6. ✅
- §1 dashboard overview/traffic/live → Tasks 9, 10, 11. ✅
- §1 sidebar/layout → Task 7. ✅
- §1 settings (trackingEnabled) → Task 2 (lib) + respetado en Task 5. ✅
- §4.12 tema morado/azul → constraint global + Tasks 7-11. ✅
- §8 criterios de aceptación → Tasks 1-11. ✅

Limitaciones documentadas: el mapa mundial D3 (WorldMapV2) no se incluye en Fase 2 (live usa lista geolocalizada); se puede portar como mejora. Sin Redis, los datos son efímeros en Vercel.
