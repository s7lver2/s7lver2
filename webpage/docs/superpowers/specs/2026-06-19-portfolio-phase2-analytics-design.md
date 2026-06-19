# Fase 2: Analytics de visitas + auth mínima — Design Spec

**Fecha:** 2026-06-19
**Estado:** Diseño aprobado (decisiones del brainstorming) · spec de Fase 2
**Depende de:** Fase 1 (completada)
**Stack base:** Next.js 14.1 (App Router) · TypeScript · Tailwind CSS 3.3 · React 18

---

## 0. Contexto y ajuste de arquitectura

La descomposición original (ver `2026-06-19-portfolio-phase1-redesign-design.md` §0) ponía **toda** la autenticación en la Fase 3 y el analytics en la Fase 2. Al revisar el patrón real del linktree se confirma una dependencia: **el dashboard de analytics vive en `/admin` y debe estar protegido por login** desde el primer momento.

**Refinamiento adoptado:**
- **Fase 2 (este doc):** capa de storage (Redis + fallback JSON) + **auth mínima de root** (sesión HMAC, login del propietario desde env, protección de rutas) + tracking de visitas + dashboard de analytics (overview, traffic, live).
- **Fase 3:** sistema multiusuario completo encima de esta base — CRUD de usuarios, roles owner/admin, OTP setup, WebAuthn, audit log, página de usuarios y de cuenta.

Esto hace que cada fase entregue software funcional y seguro. La auth de Fase 2 es un subconjunto del sistema de Fase 3: las mismas funciones `createSessionToken` / `getSession` / `hashPassword`, solo que con un único usuario root desde env. La Fase 3 extiende `auth.ts` y añade `users.ts` sin reescribir lo de Fase 2.

**Decisiones ya tomadas (brainstorming):**
- Storage: JSON local en desarrollo + Upstash Redis en producción (filesystem de Vercel es efímero).
- Replicar el patrón del linktree (no reinventar).

---

## 1. Alcance de la Fase 2

### En alcance
- **Capa de storage dual** (`lib/redis.ts`): Upstash Redis si hay env vars, fallback a JSON en `data/` (o `/tmp` en Vercel).
- **Auth mínima** (`lib/auth.ts`): token de sesión HMAC-SHA256, cookie httpOnly, login de root desde `ROOT_PASSWORD`/`ADMIN_PASSWORD`, `getSession()` para proteger route handlers, página `/admin/login`.
- **Tracking de visitas**: componente `TrackingBeacon` en el layout público + endpoint `POST /api/tracking` que captura página, referrer, IP, user-agent, sessionId; geolocalización por IP; detección de bots; presencia (heartbeat).
- **Capa de datos de visitas** (`lib/data.ts`): tipos `Visit`/`Stats`, `parseUA`, `detectBot`, `addVisit`, `readVisits`, `computeStats` (top pages/countries/devices/browsers, bounce rate, avg session, byDayHour, series 7 días).
- **Presencia** (`lib/presence.ts`): sesiones online con TTL.
- **APIs de admin**: `GET /api/admin/stats` (snapshot), `GET /api/admin/stream` (SSE live).
- **Dashboard** (`/admin`): overview con KPIs, gráfico de tráfico, donut de dispositivos, top pages/countries/referrers/browsers, sesiones recientes.
- **Páginas** `/admin/traffic` (heatmap día×hora, funnel) y `/admin/live` (feed en vivo + mapa).
- **Sidebar** (`AdminSidebar`) y layout de `/admin`.
- **Settings mínimos** (`lib/settings.ts`): toggle `trackingEnabled` (para poder desactivar el tracking).

### Fuera de alcance (Fase 3)
- CRUD de usuarios, roles owner/admin, OTP setup, WebAuthn, audit log, página `/admin/users`, `/admin/account`.
- Geography page con mapa mundial completo (WorldMapV2 D3) — en Fase 2 el `/admin/live` usa un mapa simplificado o lista; el mapa D3 completo se puede portar en Fase 3 o como mejora.

### Dependencias nuevas (npm)
- `@upstash/redis@^1.37.0` — cliente Redis (solo se activa con env vars).
- `recharts@^2.x` — gráficos del dashboard (nota: linktree usa v3 con React 19; este proyecto usa React 18, así que se fija **recharts v2**, compatible con React 18).
- `bcryptjs@^3.0.3` + `@types/bcryptjs` — hash de la contraseña root.

> Geolocalización: se usa **`ip-api.com`** (gratis, 45 req/min, con timeout de 2s) como en el linktree, con fallback a los headers de Vercel (`x-vercel-ip-country`, `x-vercel-ip-city`, `x-vercel-ip-latitude/longitude`) cuando estén disponibles. Sin dependencia npm.

---

## 2. Arquitectura y flujo de datos

```
PÚBLICO
  layout.tsx (público)
    └─ <TrackingBeacon/>  ──POST /api/tracking { page, referrer }──┐
                          ──heartbeat cada 15s───────────────────┤
                          ──sendBeacon 'leave' en pagehide───────┘
                                                                   │
                                              /api/tracking (server)│
                                                ├─ getTrueClientIp  │
                                                ├─ detectBot        │
                                                ├─ geo(ip) ip-api   │
                                                ├─ addVisit ────────┼─► storage (redis|fs)
                                                └─ touchPresence ───┘

ADMIN (protegido)
  /admin/login ──POST /api/admin/auth { password }──► cookie admin_session (HMAC)
  /admin/* (layout + AdminSidebar)
    ├─ getSession(req) en cada route handler; 401 → redirect /admin/login
    ├─ /admin (overview)  ──GET /api/admin/stats (cada 12s)──► readVisits→computeStats
    ├─ /admin/traffic     ──GET /api/admin/stats (cada 15s)
    └─ /admin/live        ──EventSource /api/admin/stream (cada 3s)──► presence + recent
```

**Storage agnóstico** (`lib/redis.ts`): expone `kvGet/kvSet/kvHGetAll/kvHSet/kvLPush/kvLRange...` que internamente usan Upstash si `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (o `KV_*`) están definidas; si no, leen/escriben archivos JSON en `data/` (dev) o `/tmp` (Vercel). Todo `lib/data.ts`, `lib/presence.ts`, `lib/settings.ts` y (en Fase 3) `lib/users.ts`/`lib/audit.ts` consumen esta capa.

---

## 3. Modelos de datos

```ts
// lib/data.ts
interface Visit {
  id: string; page: string; timestamp: string;          // ISO
  country?: string; countryCode?: string; city?: string;
  lat?: number; lon?: number;
  referrer?: string; ip?: string; ua?: string;
  browser?: string; os?: string; device?: 'desktop'|'mobile'|'tablet';
  sessionId: string; isNew?: boolean; duration?: number; // segundos
  isBot?: boolean; botReason?: string;
}

interface Stats {
  totalVisits: number; uniqueVisitors: number; activeLastHour: number;
  bounceRate: number; avgSessionDuration: number;
  series7d: { date: string; visits: number }[];
  topPages:    { name: string; count: number }[];
  topCountries:{ name: string; code?: string; count: number }[];
  topReferrers:{ name: string; count: number }[];
  browsers:    { name: string; count: number }[];
  devices:     { name: string; count: number }[];
  byDayHour:   number[][];                                // [7][24]
  recentSessions: { sessionId: string; country?: string; city?: string;
                    pages: number; duration: number; lastSeen: string }[];
}

// lib/auth.ts
interface SessionPayload { uid: string; u: string; r: 'root'|'user';
  p: string[]|'all'; setup?: boolean; iat: number }

// lib/settings.ts
interface SiteSettings { trackingEnabled: boolean; updatedAt: string }
```

---

## 4. Componentes — diseño por unidad

### 4.1 `lib/redis.ts` — capa de storage dual
Portar del linktree. Decide Upstash vs FS por env. Expone helpers genéricos. Una sola responsabilidad: persistencia.

### 4.2 `lib/auth.ts` — sesión mínima
`createSessionToken(payload, secret)`, `getSession(req?)`, `validateSession()`, `hashPassword()`, `verifyPassword()`. Cookie `admin_session` (httpOnly, sameSite lax, secure en prod, 7 días). Secret de `ADMIN_SECRET`. Root password de `ROOT_PASSWORD ?? ADMIN_PASSWORD`. (En Fase 3 se amplía con `resolveLogin` multiusuario.)

### 4.3 `lib/settings.ts` — settings mínimos
`getSettings()`, `updateSettings(patch)`. Solo `trackingEnabled` en Fase 2. (Fase 3 añade más toggles.)

### 4.4 `lib/data.ts` — visitas + stats
`parseUA(ua)` → {browser, os, device}; `detectBot(ua, headers)` → {isBot, reason}; `addVisit(v)`; `readVisits(limit?)`; `computeStats(visits)` → `Stats`. Trim a 10.000 visitas. Portar lógica del linktree, adaptando los tipos a los de §3.

### 4.5 `lib/presence.ts` — sesiones online
`touchPresence(sessionId, info)`, `dropPresence(sessionId)`, `getOnlineSessions()`. TTL online 40s, prune 10min.

### 4.6 `components/TrackingBeacon.tsx` — cliente
Envía pageview al montar, heartbeat cada 15s, `leave` en `pagehide`/`visibilitychange` con `navigator.sendBeacon`. Calcula `duration`. Maneja `sessionId` (cookie/localStorage). Se monta en el `layout.tsx` público.

### 4.7 `api/tracking/route.ts` — POST
Captura IP real, UA, página, referrer; `detectBot`; geo por IP (ip-api con timeout, fallback headers Vercel); `addVisit` + `touchPresence`. Respeta `settings.trackingEnabled`. Maneja tipos `pageview` | `heartbeat` | `leave`.

### 4.8 `api/admin/auth/route.ts` — POST/DELETE
POST: valida `ROOT_PASSWORD`; éxito → cookie de sesión root. DELETE: logout. Delay 800ms en fallo.

### 4.9 `api/admin/stats/route.ts` — GET
`getSession` guard → `readVisits` → `computeStats` → JSON `Stats`.

### 4.10 `api/admin/stream/route.ts` — GET (SSE)
`getSession` guard → cada 3s emite `{ activeLastHour, todayTotal, recent[], online[], events[], ts }`.

### 4.11 Componentes de UI admin
- `app/admin/layout.tsx` — flex sidebar + main; si ruta es `/admin/login`, render sin chrome.
- `app/admin/components/AdminSidebar.tsx` — nav (Overview, Traffic, Live), perfil/logout, live indicator. En Fase 2 sin toggles de usuario/maintenance (se amplía en Fase 3).
- `app/admin/components/KPICard.tsx`, `DonutChart.tsx` — portar del linktree (props en §referencia).
- `app/admin/login/page.tsx` — formulario password (sin WebAuthn ni setup modal todavía; eso es Fase 3).
- `app/admin/page.tsx` — overview.
- `app/admin/traffic/page.tsx` — heatmap + funnel.
- `app/admin/live/page.tsx` — feed en vivo + lista/mapa simple de sesiones online.

### 4.12 Diseño visual
El panel adopta el mismo lenguaje **dark + glassmorphism morado/azul** del portfolio (NO el rojo del linktree). Reutiliza `.card-glass`, `.card-hover` de Fase 1. Sidebar oscuro con acento morado en el item activo.

---

## 5. Errores y casos límite
- **Sin Redis**: cae a FS automáticamente; en Vercel sin Redis, los datos viven en `/tmp` y se pierden en redeploy (documentar).
- **Geo timeout / rate limit ip-api**: la visita se guarda igual, sin geo.
- **Bots**: se marcan `isBot` y se excluyen de las stats principales (se pueden contar aparte).
- **Tracking desactivado**: `/api/tracking` responde 204 sin guardar.
- **No autenticado**: route handlers admin → 401; páginas admin → redirect `/admin/login`.
- **SSE**: cierra el stream al desconectar; limita `recent`/`events`.

---

## 6. Testing
- Sin test runner (igual que Fase 1). Gate por tarea: `npm run build` + verificación manual en `npm run dev`.
- Smoke de endpoints: `POST /api/tracking` guarda visita; `GET /api/admin/stats` (con cookie) devuelve `Stats`; login correcto/incorrecto.
- Verificación manual del dashboard: KPIs, gráficos, live feed.

---

## 7. Archivos (Fase 2)

**Nuevos**
- `lib/redis.ts`, `lib/auth.ts`, `lib/settings.ts`, `lib/data.ts`, `lib/presence.ts`
- `app/components/TrackingBeacon.tsx`
- `app/api/tracking/route.ts`
- `app/api/admin/auth/route.ts`, `app/api/admin/stats/route.ts`, `app/api/admin/stream/route.ts`
- `app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/login/page.tsx`, `app/admin/traffic/page.tsx`, `app/admin/live/page.tsx`
- `app/admin/components/AdminSidebar.tsx`, `KPICard.tsx`, `DonutChart.tsx`

**Modificados**
- `app/layout.tsx` — montar `<TrackingBeacon/>`.
- `package.json` — añadir `@upstash/redis`, `recharts@^2`, `bcryptjs`, `@types/bcryptjs`.
- `.env.example` — `ADMIN_SECRET`, `ROOT_PASSWORD`/`ADMIN_PASSWORD`, `UPSTASH_REDIS_REST_URL/TOKEN`, `NEXT_PUBLIC_SERVER_LAT/LON`.

---

## 8. Criterios de aceptación
1. Las visitas al portfolio se registran y persisten (FS en dev).
2. `/admin/login` autentica con `ROOT_PASSWORD`; rutas admin protegidas (401/redirect sin sesión).
3. `/admin` muestra KPIs, gráfico de tráfico, donut de dispositivos y top pages/countries con datos reales.
4. `/admin/live` muestra sesiones activas en tiempo real vía SSE.
5. El panel usa el lenguaje visual morado/azul del portfolio.
6. Funciona sin Redis (FS) y con Redis si las env vars están presentes.
7. `npm run build` pasa; el tracking se puede desactivar con `trackingEnabled=false`.
