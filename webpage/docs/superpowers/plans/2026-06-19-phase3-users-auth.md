# Fase 3: Usuarios + roles + WebAuthn + audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender la base de auth de la Fase 2 a un sistema multiusuario completo (roles owner/admin, OTP setup, WebAuthn, audit log, gestión de usuarios y cuenta), replicando el patrón del linktree.

**Architecture:** Sobre `lib/auth.ts` y la capa de storage de Fase 2, se añaden `lib/users.ts`, `lib/audit.ts`, `lib/webauthn.ts` y sus endpoints. El login pasa a multiusuario con setup por OTP y pestaña WebAuthn. Páginas nuevas: `/admin/users`, `/admin/account`, `/admin/audit`. Tema morado/azul del portfolio.

**Tech Stack:** Next.js 14.1, TypeScript, Tailwind 3.3, React 18, `bcryptjs`, `@simplewebauthn/server`+`browser`, `@vercel/blob`, `@upstash/redis`.

**Reference:** `E:\linktree` contiene la implementación funcional. Muchas tareas son **portar** archivos concretos, adaptando: tema a morado/azul, modelos a la spec §2, y quitando features no pedidas (raffles/codes/maintenance). Rutas de referencia citadas por tarea.

## Global Constraints

- No reescribir lo de Fase 2: extender `lib/auth.ts` y `/api/admin/auth`, reutilizar `lib/redis.ts`, `hashPassword`/`verifyPassword`, `getSession`.
- Tema morado `#8b5cf6` / azul `#3b82f6` (NO rojo). Reutilizar `.card-glass`/`.card-hover`.
- root nunca persiste password (siempre desde env). No permitir borrar root.
- OTP de un solo uso; token de setup expira; counter anti-replay en WebAuthn.
- Permisos: `owner`/root para crear/eliminar usuarios; `admin`+ para acciones (suspend/message/resetOtp). 403 si falta permiso, 401 sin sesión.
- `@simplewebauthn/server` y `@simplewebauthn/browser` deben compartir major (13.x).
- Avatares: `@vercel/blob` en prod; sin `BLOB_READ_WRITE_TOKEN`, deshabilitar subida (documentar).
- Toda acción admin registra una entrada de audit.
- Gate por tarea (sin test runner): `npm run build` + verificación manual. Un commit por tarea.

---

## File Structure

**Nuevos**
- `app/lib/users.ts`, `app/lib/audit.ts`, `app/lib/webauthn.ts`
- `app/api/admin/auth/setup/route.ts`
- `app/api/admin/users/route.ts`, `app/api/admin/users/[id]/route.ts`
- `app/api/admin/me/route.ts`, `app/api/admin/audit/route.ts`, `app/api/admin/upload/route.ts`
- `app/api/admin/webauthn/register/options/route.ts`, `register/verify/route.ts`, `login/options/route.ts`, `login/verify/route.ts`, `credentials/[id]/route.ts`
- `app/admin/users/page.tsx`, `app/admin/account/page.tsx`, `app/admin/audit/page.tsx`

**Modificados**
- `app/lib/auth.ts`, `app/api/admin/auth/route.ts`, `app/admin/login/page.tsx`, `app/admin/components/AdminSidebar.tsx`, `package.json`, `.env.example`, `README.md`

---

## Task 1: Dependencias + helpers de permisos

**Files:** Modify `package.json`, `app/lib/auth.ts`.

**Interfaces:**
- Produces:
  ```ts
  export async function requireAuth(req?: Request): Promise<SessionPayload | null>; // null si no auth o setup
  export function isOwner(s: SessionPayload): boolean; // root || p==='all' || p.includes('owner')
  export function isAdmin(s: SessionPayload): boolean; // owner || p.includes('admin')
  ```

- [ ] **Step 1: Instalar dependencias**

```bash
npm install @simplewebauthn/server@^13.3.1 @simplewebauthn/browser@^13.3.0 @vercel/blob@^2.3.3
npm install -D @simplewebauthn/types@^12.0.0
```

- [ ] **Step 2: Añadir helpers a `app/lib/auth.ts`**

Sin tocar las firmas existentes, añadir:

```ts
export async function requireAuth(req?: Request): Promise<SessionPayload | null> {
  const s = await getSession(req);
  if (!s || s.setup) return null;
  return s;
}
export function isOwner(s: SessionPayload): boolean {
  return s.r === 'root' || s.p === 'all' || (Array.isArray(s.p) && s.p.includes('owner'));
}
export function isAdmin(s: SessionPayload): boolean {
  return isOwner(s) || (Array.isArray(s.p) && s.p.includes('admin'));
}
```

- [ ] **Step 3: Build + Commit**

Run: `npm run build` → OK.
```bash
git add package.json package-lock.json app/lib/auth.ts
git commit -m "feat(users): add webauthn/blob deps and permission helpers"
```

---

## Task 2: Modelo y CRUD de usuarios (`lib/users.ts`)

**Files:** Create `app/lib/users.ts`.

**Interfaces:**
- Consumes: `kvGetJSON`/`kvSetJSON` (F2), `hashPassword`/`verifyPassword` (F2).
- Produces:
  ```ts
  export type Permission = 'admin' | 'owner';
  export interface AdminUser { /* spec §2 */ }
  export interface SafeUser { /* AdminUser sin hashes */ }
  export interface WebAuthnCredential { /* spec §2 */ }
  export function toSafeUser(u: AdminUser): SafeUser;
  export async function ensureRoot(): Promise<void>;
  export async function listUsers(): Promise<AdminUser[]>;
  export async function getUser(id: string): Promise<AdminUser | null>;
  export async function getUserByUsername(username: string): Promise<AdminUser | null>;
  export async function createUser(input: { username: string; name: string; avatar?: string; permissions: Permission[]; createdBy?: string }): Promise<{ ok: boolean; user?: AdminUser; otp?: string; error?: string }>;
  export async function updateUser(id: string, patch: Partial<AdminUser>): Promise<AdminUser | null>;
  export async function deleteUser(id: string): Promise<{ ok: boolean; error?: string }>;
  export async function resetOtp(id: string): Promise<{ ok: boolean; otp?: string; error?: string }>;
  export function genSecurityKey(): string;
  ```

- [ ] **Step 1: Crear `app/lib/users.ts`**

Portar de `E:\linktree\app\lib\users.ts`, adaptando:
- Prefijo de storage `s7lver:users` / `users.json`.
- Root password: `process.env.ROOT_PASSWORD ?? process.env.ADMIN_PASSWORD ?? 's7lver_admin'`.
- OTP: 2 grupos de 4 chars; security key: 5 grupos de 4. Guardar `otpHash`/`securityKeyHash` con `hashPassword`.
- `createUser` valida unicidad de username, genera OTP, `pendingSetup:true`, retorna `{ user, otp }`.
- `deleteUser` rechaza root.
- `toSafeUser` quita `passwordHash/securityKeyHash/otpHash` y redacta `webauthnCredentials`.

- [ ] **Step 2: Build + Commit**

Run: `npm run build` → OK.
```bash
git add app/lib/users.ts
git commit -m "feat(users): add AdminUser model and CRUD"
```

---

## Task 3: Login multiusuario + setup (`resolveLogin`, `completeSetup`)

**Files:** Modify `app/lib/users.ts` (añadir login/setup); Modify `app/api/admin/auth/route.ts`; Create `app/api/admin/auth/setup/route.ts`.

**Interfaces:**
- Produces (en users.ts):
  ```ts
  export type LoginResult =
    | { ok: true; kind: 'session'; user: AdminUser }
    | { ok: true; kind: 'setup'; user: AdminUser }
    | { ok: false; error: string };
  export async function resolveLogin(username: string, credential: string, method: 'password'|'key'): Promise<LoginResult>;
  export async function completeSetup(id: string, choice: { type: 'password'; password: string } | { type: 'key'; key: string }): Promise<{ ok: boolean; user?: AdminUser; error?: string }>;
  export async function touchLastLogin(id: string): Promise<void>;
  ```

- [ ] **Step 1: Añadir login/setup a `app/lib/users.ts`**

Portar `resolveLogin`/`completeSetup`/`touchLastLogin` del linktree:
- `resolveLogin`: si `username==='root'`, comparar contra env (kind 'session'). Si no, buscar usuario; si `suspended` → error; si `pendingSetup` → comparar OTP (kind 'setup'); si no, verificar password/key (kind 'session'); upgrade de hash legacy si aplica.
- `completeSetup`: setea password o key, borra `otpHash`, `pendingSetup:false`.

- [ ] **Step 2: Ampliar `app/api/admin/auth/route.ts` a multiusuario**

Reemplazar el POST de Fase 2 por uno que use `resolveLogin(username ?? 'root', credential, method)`:
- `kind==='setup'` → emitir token con `setup:true`, responder `{ ok:true, needsSetup:true, name }`.
- `kind==='session'` → `touchLastLogin`, emitir token con `uid/u/r/p` del usuario (root: `r:'root', p:'all'`; usuario: `r:'user', p:permissions`), responder `{ ok:true }`.
- En fallo: delay 800ms, `{ error }` 401. En éxito: emitir sesión. El **cableado del audit** (`login.success`/`login.fail`) se añade en la Task 4 Step 3, una vez `lib/audit.ts` exista — así se evita la dependencia circular. En esta tarea no llames a `appendAudit` todavía.

> Nota de orden: la Task 4 (audit) crea `lib/audit.ts` y luego cablea `appendAudit` en este endpoint. Si ejecutas el plan de forma estrictamente lineal, déjalo así: auth funciona en Task 3 y gana el registro de audit en Task 4.

- [ ] **Step 3: Crear `app/api/admin/auth/setup/route.ts`**

Portar del linktree: valida `session.setup===true`, `completeSetup(session.uid, choice)`, emite token completo, cookie 7 días. `GET` devuelve una security key sugerida (`genSecurityKey`).

- [ ] **Step 4: Build + smoke**

Run: `npm run build` → OK.
Smoke (requiere Task 5 para crear usuarios; o crear un usuario a mano en `data/users.json`): login root sigue funcionando; login de usuario con OTP devuelve `needsSetup`.

- [ ] **Step 5: Commit**

```bash
git add app/lib/users.ts app/api/admin/auth/route.ts app/api/admin/auth/setup/route.ts
git commit -m "feat(users): multi-user login and OTP setup flow"
```

---

## Task 4: Audit log (`lib/audit.ts` + endpoint)

> Ejecutar antes del cableado de audit en login (ver nota en Task 3).

**Files:** Create `app/lib/audit.ts`, `app/api/admin/audit/route.ts`.

**Interfaces:**
- Produces:
  ```ts
  export interface AuditEntry { /* spec §2 */ }
  export type AuditAction = /* spec §2 */;
  export async function appendAudit(entry: Omit<AuditEntry,'id'|'ts'>): Promise<void>;
  export async function listAudit(limit?: number): Promise<AuditEntry[]>;
  ```

- [ ] **Step 1: Crear `app/lib/audit.ts`**

Portar del linktree. Circular buffer máx 2000 en `s7lver:audit` / `audit.json`.

- [ ] **Step 2: Crear `app/api/admin/audit/route.ts`**

`GET` con guard `requireAuth` + `isAdmin`; devuelve `{ entries: listAudit(limit) }`.

- [ ] **Step 3: Cablear audit en login (Task 3)**

Añadir `appendAudit({ action:'login.success'|'login.fail', actorId, actorName, actorUsername })` en `app/api/admin/auth/route.ts`.

- [ ] **Step 4: Build + Commit**

Run: `npm run build` → OK.
```bash
git add app/lib/audit.ts app/api/admin/audit/route.ts app/api/admin/auth/route.ts
git commit -m "feat(users): add audit log and wire login events"
```

---

## Task 5: Endpoints de usuarios + me + upload

**Files:** Create `app/api/admin/users/route.ts`, `app/api/admin/users/[id]/route.ts`, `app/api/admin/me/route.ts`, `app/api/admin/upload/route.ts`.

**Interfaces:**
- Consumes: `listUsers`/`createUser`/`updateUser`/`deleteUser`/`resetOtp`/`getUser`/`toSafeUser` (Tasks 2-3), `requireAuth`/`isOwner`/`isAdmin` (Task 1), `appendAudit` (Task 4).

- [ ] **Step 1: `app/api/admin/users/route.ts`**

`GET`: `requireAuth` → `{ users: (await listUsers()).map(toSafeUser) }`.
`POST`: `requireAuth` + `isOwner` (403 si no) → `createUser({...body, createdBy})` → audit `user.create` → `{ user: toSafeUser(user), otp }`.

- [ ] **Step 2: `app/api/admin/users/[id]/route.ts`**

`PATCH`: `requireAuth`. Acciones:
- `suspend`/`unsuspend`/`resetOtp`/`sendMessage`/`dismissMessage` → requieren `isAdmin`.
- Editar `name`/`avatar`/`permissions` → requieren `isOwner`.
Aplicar con `updateUser`/`resetOtp`; audit la acción; devolver `{ user: toSafeUser(...) }` o `{ otp }` (resetOtp).
`DELETE`: `requireAuth` + `isOwner` → `deleteUser(id)` (rechaza root) → audit `user.delete`.

- [ ] **Step 3: `app/api/admin/me/route.ts`**

`GET`: `requireAuth` → datos del usuario actual (root sintetizado si `uid==='root'`) + permisos.
`PATCH`: editar perfil propio (name/pronouns/bio/avatar/bannerUrl) y `changePassword: { current, next }` (verificar current, hashear next, audit `account.password`); audit `account.update`.

- [ ] **Step 4: `app/api/admin/upload/route.ts`**

`POST`: `requireAuth`. Si `BLOB_READ_WRITE_TOKEN` presente → `@vercel/blob put()` y devolver URL; si no → 501 `{ error: 'Uploads disabled (no blob token)' }`. Portar del linktree.

- [ ] **Step 5: Build + smoke**

Run: `npm run build` → OK.
Smoke: con sesión root, `POST /api/admin/users` crea usuario y devuelve OTP; `GET /api/admin/users` lista; `PATCH .../[id] {action:'suspend'}` suspende.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/users app/api/admin/me app/api/admin/upload
git commit -m "feat(users): user CRUD, me profile and upload endpoints"
```

---

## Task 6: WebAuthn lib + endpoints

**Files:** Create `app/lib/webauthn.ts` y las 5 rutas en `app/api/admin/webauthn/`.

**Interfaces:**
- Produces (lib):
  ```ts
  export function getRpConfig(): { rpID: string; origin: string };
  export async function storeChallenge(challenge: string, meta?: string): Promise<string>;
  export async function consumeChallenge(token: string): Promise<{ challenge: string; meta?: string } | null>;
  ```

- [ ] **Step 1: Crear `app/lib/webauthn.ts`**

Portar del linktree. `getRpConfig`: en prod usa hostname de `NEXT_PUBLIC_SITE_URL`/`VERCEL_URL`; en dev `rpID:'localhost'`, `origin:'http://localhost:3000'`. Challenge store TTL 120s en `s7lver:webauthn_challenges`.

- [ ] **Step 2: `register/options` + `register/verify`**

Portar. `options`: `requireAuth`, `generateRegistrationOptions` (attestation 'none', cross-platform, userVerification 'discouraged', residentKey 'discouraged', excludeCredentials existentes), `storeChallenge(uid)`, devolver opciones + `_token`. `verify`: `consumeChallenge`, `verifyRegistrationResponse`, guardar credencial en el usuario, audit `webauthn.register`.

- [ ] **Step 3: `login/options` + `login/verify`**

`options`: `{ username }` → buscar usuario → `generateAuthenticationOptions` con `allowCredentials` → `_token`. `verify`: `consumeChallenge`, localizar credencial, `verifyAuthenticationResponse`, actualizar counter, emitir sesión (cookie), audit `login.success`.

- [ ] **Step 4: `credentials/[id]` DELETE**

`requireAuth` → quitar la credencial del usuario → audit `webauthn.delete`.

- [ ] **Step 5: Build + smoke**

Run: `npm run build` → OK.
Smoke (sin autenticador físico, verificar a nivel endpoint): `register/options` con sesión devuelve opciones + `_token`; `login/options` con username válido devuelve opciones.

- [ ] **Step 6: Commit**

```bash
git add app/lib/webauthn.ts app/api/admin/webauthn
git commit -m "feat(users): WebAuthn register/login endpoints"
```

---

## Task 7: Login UI ampliado (setup modal + WebAuthn)

**Files:** Modify `app/admin/login/page.tsx`.

**Interfaces:**
- Consumes: `/api/admin/auth`, `/api/admin/auth/setup`, `/api/admin/webauthn/login/*`, `@simplewebauthn/browser`.

- [ ] **Step 1: Ampliar `app/admin/login/page.tsx`**

Portar del linktree, re-temado a morado/azul:
- Estado `mode: 'password'|'webauthn'`, `username`, `password`, `error`, `loading`.
- Password: `POST /api/admin/auth { username, password }`. Si `needsSetup` → abrir SetupModal.
- SetupModal: pide password+confirm → `POST /api/admin/auth/setup { type:'password', password }` → `/admin`.
- WebAuthn: `startAuthentication` con options de `/api/admin/webauthn/login/options`, luego `/verify` → `/admin`.

- [ ] **Step 2: Build + manual**

Run: `npm run build` → OK.
En dev: login root sigue OK; pestaña WebAuthn presente; crear usuario (Task 5/9) + login con OTP abre el setup modal.

- [ ] **Step 3: Commit**

```bash
git add app/admin/login/page.tsx
git commit -m "feat(users): login with OTP setup modal and WebAuthn tab"
```

---

## Task 8: Página de usuarios (`/admin/users`)

**Files:** Create `app/admin/users/page.tsx`; Modify `app/admin/components/AdminSidebar.tsx`.

- [ ] **Step 1: `app/admin/users/page.tsx`**

Portar del linktree, re-temado:
- `GET /api/admin/users` → grid de tarjetas (avatar, nombre, @handle, rol badge, online dot/suspended, "OTP pending").
- Botón "+ new user" → modal (nombre, username, avatar, permisos) → `POST` → muestra OTP en modal.
- Click tarjeta → modal detalle con acciones: suspend/unsuspend, sendMessage, resetOtp (muestra nuevo OTP), delete (owner/root).
- Manejar 401 → redirect login; ocultar acciones según permisos del `me`.

- [ ] **Step 2: Añadir entrada Users al sidebar**

En `AdminSidebar.tsx` añadir nav item "Users" → `/admin/users` (visible para isAdmin; crear/eliminar gated en la página).

- [ ] **Step 3: Build + manual**

Run: `npm run build` → OK.
En dev (root): crear usuario muestra OTP; suspender/eliminar funciona; el grid refleja estado.

- [ ] **Step 4: Commit**

```bash
git add app/admin/users/page.tsx app/admin/components/AdminSidebar.tsx
git commit -m "feat(users): users management page"
```

---

## Task 9: Cuenta (`/admin/account`)

**Files:** Create `app/admin/account/page.tsx`.

- [ ] **Step 1: `app/admin/account/page.tsx`**

Portar del linktree, re-temado:
- `GET /api/admin/me` → form de perfil (name, pronouns, bio, avatar, banner) → `PATCH /api/admin/me`.
- Cambiar contraseña: modal current/next/confirm → `PATCH /api/admin/me { changePassword }`.
- Sección WebAuthn: listar credenciales; "add key" → `register/options` + `startRegistration` + `register/verify`; eliminar → `DELETE credentials/[id]`.
- Mensajes pendientes: mostrar/descartar.

- [ ] **Step 2: Build + manual**

Run: `npm run build` → OK.
En dev: editar perfil persiste; cambiar contraseña funciona; (si hay autenticador) registrar llave; si no, verificar que el flujo arranca.

- [ ] **Step 3: Commit**

```bash
git add app/admin/account/page.tsx
git commit -m "feat(users): account page with profile, password and WebAuthn keys"
```

---

## Task 10: Página de audit (`/admin/audit`) + docs/verificación

**Files:** Create `app/admin/audit/page.tsx`; Modify `app/admin/components/AdminSidebar.tsx`, `.env.example`, `README.md`.

- [ ] **Step 1: `app/admin/audit/page.tsx`**

`GET /api/admin/audit` → lista buscable (por actor/acción/target) con timestamps relativos. Re-temado morado/azul. Portar del linktree.

- [ ] **Step 2: Añadir entrada Audit al sidebar.**

- [ ] **Step 3: `.env.example` + `README.md`**

Añadir:
```
# Phase 3 (users/auth)
NEXT_PUBLIC_SITE_URL=https://your-domain   # WebAuthn RP id/origin in prod
BLOB_READ_WRITE_TOKEN=                       # avatar/banner uploads (optional)
```
README: documentar roles (root/owner/admin), flujo OTP, WebAuthn (requiere HTTPS/dominio; localhost OK en dev), y que sin blob token las subidas están deshabilitadas.

- [ ] **Step 4: Build + verificación integral**

Run: `npm run build` → OK.
Checklist en dev:
- Crear usuario (owner) → OTP → setup → login del usuario.
- admin no puede crear/eliminar; owner/root sí.
- suspend bloquea login; sendMessage aparece; resetOtp da nuevo OTP.
- cambiar contraseña en /account; registrar llave (si hay autenticador).
- audit log refleja todas las acciones.
- tema morado/azul; root sigue OK.

- [ ] **Step 5: Commit**

```bash
git add app/admin/audit/page.tsx app/admin/components/AdminSidebar.tsx .env.example README.md
git commit -m "feat(users): audit page; document Phase 3 roles, OTP and WebAuthn"
```

---

## Self-Review (cobertura de la spec)

- §2 modelos (AdminUser/SafeUser/WebAuthnCredential/AuditEntry) → Tasks 2, 4, 6. ✅
- §3 roles/permisos → Task 1 (helpers) + guards en Tasks 5-6, 8. ✅
- §4 crear usuario / OTP setup → Tasks 3, 5, 7, 8. ✅
- §4 WebAuthn registro/login → Tasks 6, 7, 9. ✅
- §4 acciones sobre usuario → Tasks 5, 8. ✅
- §5.1 users.ts → Tasks 2, 3. ✅
- §5.2 audit.ts → Task 4. ✅
- §5.3 webauthn.ts → Task 6. ✅
- §5.4 endpoints → Tasks 3, 4, 5, 6. ✅
- §5.5 páginas/UI → Tasks 7, 8, 9, 10. ✅
- §8 upload/avatares → Task 5. ✅
- §9 criterios de aceptación → Tasks 1-10. ✅

Notas/limitaciones: orden — ejecutar Task 4 (audit) antes de cablear audit en login (Task 3 Step 2). WebAuthn requiere autenticador físico para smoke completo; sin él se verifica el flujo options/verify a nivel endpoint. Subida de avatares deshabilitada sin `BLOB_READ_WRITE_TOKEN`.
```
