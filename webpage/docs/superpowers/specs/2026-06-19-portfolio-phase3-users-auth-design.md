# Fase 3: Usuarios + roles + WebAuthn + audit — Design Spec

**Fecha:** 2026-06-19
**Estado:** Diseño aprobado (decisiones del brainstorming) · spec de Fase 3
**Depende de:** Fase 2 (storage dual + `lib/auth.ts` + `/admin` shell + login root)
**Stack base:** Next.js 14.1 (App Router) · TypeScript · Tailwind CSS 3.3 · React 18

---

## 0. Contexto

La Fase 2 dejó funcionando: storage dual (Redis/JSON), `lib/auth.ts` con sesión root mínima, el shell de `/admin` con sidebar, login de propietario y el dashboard de analytics protegido. La Fase 3 **extiende** esa base a un sistema multiusuario completo, replicando el del linktree, con la **decisión confirmada de incluir WebAuthn** (llave de seguridad / Flipper Zero).

No se reescribe lo de Fase 2: se amplía `lib/auth.ts` (login multiusuario) y se añaden `lib/users.ts`, `lib/audit.ts`, `lib/webauthn.ts`, los endpoints correspondientes y las páginas `/admin/users` y `/admin/account`.

---

## 1. Alcance de la Fase 3

### En alcance
- **Modelo de usuarios** (`lib/users.ts`): `AdminUser`, `SafeUser`, `WebAuthnCredential`; CRUD; root implícito desde env; roles/permisos `owner`/`admin`; login multiusuario (`resolveLogin`); setup por OTP (`completeSetup`, `resetOtp`); generación de OTP y security key; upgrade de hash legacy.
- **Login multiusuario**: `/admin/login` acepta usuario+contraseña (además del root), flujo de **primer setup por OTP** (modal para fijar contraseña o llave), y pestaña **WebAuthn**.
- **WebAuthn** (`lib/webauthn.ts` + rutas): registro y login con `@simplewebauthn/server` + `@simplewebauthn/browser`; almacenamiento de credenciales en el usuario; challenge store con TTL.
- **Gestión de usuarios** (`/admin/users` + APIs): listar, crear (genera OTP), editar (nombre/avatar/permisos), acciones (suspend, unsuspend, resetOtp, sendMessage, dismissMessage), eliminar (solo owner/root). Grid de tarjetas con estado online y método de auth.
- **Cuenta propia** (`/admin/account` + `/api/admin/me`): editar perfil (nombre, pronouns, bio, avatar, banner), cambiar contraseña, registrar/eliminar llaves WebAuthn, ver y descartar mensajes.
- **Audit log** (`lib/audit.ts` + `/api/admin/audit` + `/admin/audit`): registrar todas las acciones admin; página buscable.
- **Permisos en endpoints**: extender los guards de Fase 2 con comprobación de permisos (`owner` para crear/eliminar usuarios; `admin` para acciones).
- **Sidebar ampliado**: añadir entradas Users, Audit y (opcional) toggle de tracking. Perfil con popup, mensajes pendientes.
- **Avatares/banners**: subida vía `@vercel/blob` en producción; en dev, fallback a data URL o deshabilitado (documentar).

### Fuera de alcance
- Raffles, codes, maintenance/attack mode, geography D3 (features del linktree no pedidas).
- El mapa mundial WorldMapV2 (mejora opcional).

### Dependencias nuevas (npm)
- `@simplewebauthn/server@^13.3.1`, `@simplewebauthn/browser@^13.3.0` (major debe coincidir), `@simplewebauthn/types@^12` (dev).
- `@vercel/blob@^2.3.3` (subida de avatares en prod).

---

## 2. Modelos de datos

```ts
type Permission = 'admin' | 'owner';

interface WebAuthnCredential {
  id: string;            // base64url credentialID
  publicKey: string;     // base64url COSE
  counter: number;
  transports?: string[];
  name: string;          // "Flipper Zero"
  createdAt: string;
}

interface PendingMessage { text: string; from: string; at: string }

interface AdminUser {
  id: string; username: string; name: string; avatar?: string;
  passwordHash?: string; securityKeyHash?: string; otpHash?: string;
  authMethod: 'password' | 'key' | 'webauthn';
  pendingSetup: boolean;
  permissions: Permission[];
  isRoot?: boolean; suspended?: boolean;
  pendingMessage?: PendingMessage;
  createdAt: string; createdBy?: string; lastLogin?: string; lastActive?: string;
  webauthnCredentials?: WebAuthnCredential[];
  pronouns?: string; bio?: string; bannerUrl?: string;
}

// SafeUser = AdminUser sin passwordHash/securityKeyHash/otpHash;
// webauthnCredentials redactado a { id, name, createdAt, transports }.

interface AuditEntry {
  id: string; action: AuditAction;
  actorId: string; actorName: string; actorUsername: string; actorAvatar?: string;
  target?: string; detail?: string; ts: string;
}
type AuditAction =
  | 'login.success' | 'login.fail'
  | 'user.create' | 'user.update' | 'user.delete' | 'user.suspend' | 'user.unsuspend'
  | 'user.resetOtp' | 'user.sendMessage'
  | 'account.update' | 'account.password'
  | 'webauthn.register' | 'webauthn.delete'
  | 'settings.update';
```

**Storage:** `s7lver:users` (hash o JSON array) / `users.json`; `s7lver:audit` / `audit.json` (circular, máx 2000); `s7lver:webauthn_challenges` / `webauthn_challenges.json` (TTL 120s). Vía la capa `lib/redis.ts` de Fase 2.

---

## 3. Roles y permisos
- **root**: cuenta del propietario, password desde `ROOT_PASSWORD`/`ADMIN_PASSWORD` (nunca persistida), role `'root'`, permisos `'all'`. Puede todo. Es la sesión que ya emite la Fase 2.
- **owner**: puede gestionar usuarios (crear/editar/eliminar) + todo lo de admin.
- **admin**: puede ver analytics y ejecutar acciones sobre usuarios (suspend, message, resetOtp) pero no crear/eliminar.
- `ensureRoot()` crea el registro de metadata de root si no existe (sin password).
- Guards: extender `getSession` con helpers `requireAuth()`, `requireOwner()`; comprobar `session.r==='root' || session.p==='all' || session.p.includes('owner')`.

---

## 4. Flujos clave

**Crear usuario (owner):** `/admin/users` → modal (nombre, username, avatar, permisos) → `POST /api/admin/users` → devuelve OTP → modal muestra OTP para compartir.

**Primer login (nuevo usuario):** login con username+OTP → token con `setup:true` → modal de setup en `/admin/login` → elige password o llave → `POST /api/admin/auth/setup` → sesión completa.

**WebAuthn registro (en cuenta):** `/admin/account` → "add key" → `POST /api/admin/webauthn/register/options` → `startRegistration()` (browser) → tocar dispositivo → `POST /api/admin/webauthn/register/verify` → credencial guardada.

**WebAuthn login:** `/admin/login` pestaña U2F → username → `POST /api/admin/webauthn/login/options` → `startAuthentication()` → `POST /api/admin/webauthn/login/verify` → sesión.

**Acciones sobre usuario:** card → modal detalle → suspend / unsuspend / resetOtp (devuelve nuevo OTP) / sendMessage / delete. Cada una `PATCH`/`DELETE /api/admin/users/[id]` y registra audit.

---

## 5. Componentes — diseño por unidad

### 5.1 `lib/users.ts`
CRUD + login + setup. Ver firmas en el plan. Una responsabilidad: usuarios y su autenticación. Usa `hashPassword`/`verifyPassword` de Fase 2.

### 5.2 `lib/audit.ts`
`appendAudit(entry)`, `listAudit(limit)`. Circular buffer 2000.

### 5.3 `lib/webauthn.ts`
`getRpConfig()` (rpID/origin desde `NEXT_PUBLIC_SITE_URL`/`VERCEL_URL`/localhost), `storeChallenge`/`consumeChallenge` (TTL 120s).

### 5.4 Endpoints
- Ampliar `POST /api/admin/auth` para login multiusuario (root + usuarios) y emitir token `setup` cuando `pendingSetup`.
- `POST /api/admin/auth/setup` (completar setup), `GET` (sugerir security key).
- `GET/POST /api/admin/users`, `PATCH/DELETE /api/admin/users/[id]`.
- `GET/PATCH /api/admin/me`.
- `GET /api/admin/audit`.
- `POST /api/admin/upload` (avatar/banner vía @vercel/blob).
- WebAuthn: `register/options`, `register/verify`, `login/options`, `login/verify`, `credentials/[id]` (DELETE).

### 5.5 Páginas/UI
- `/admin/login` ampliado: pestaña password (con setup modal por OTP) + pestaña WebAuthn.
- `/admin/users`: grid de tarjetas (avatar, nombre, @handle, rol, online dot/suspended, OTP pending), botón "+ new user", modales create/detail.
- `/admin/account`: editar perfil, cambiar contraseña, sección de llaves WebAuthn (listar/añadir/eliminar), mensajes.
- `/admin/audit`: lista buscable con timestamps relativos.
- `AdminSidebar`: añadir Users, Audit; perfil popup; mensajes pendientes; (owner) acceso a settings de tracking.
- Tema: morado/azul del portfolio (no rojo).

---

## 6. Errores y casos límite
- No borrar root; no quitarse a uno mismo el último permiso owner.
- OTP de un solo uso; expira el token de setup.
- WebAuthn: requiere HTTPS y RP ID correcto (en dev, `localhost` funciona en navegadores modernos); documentar que para probar con dominio real hace falta `NEXT_PUBLIC_SITE_URL`.
- Subida de avatar sin `BLOB_READ_WRITE_TOKEN`: deshabilitar o usar data URL pequeña (documentar).
- Permisos: 403 cuando falta el permiso; 401 sin sesión.
- Counter anti-replay en cada login WebAuthn.

---

## 7. Testing
- Sin test runner. Gate por tarea: `npm run build` + verificación manual.
- Smoke: crear usuario → OTP → setup → login; suspend bloquea login; cambiar contraseña; registrar y usar una llave WebAuthn (si hay autenticador disponible; si no, verificar el flujo de options/verify a nivel de endpoint).
- Verificar audit log refleja las acciones.

---

## 8. Archivos (Fase 3)

**Nuevos**
- `app/lib/users.ts`, `app/lib/audit.ts`, `app/lib/webauthn.ts`
- `app/api/admin/auth/setup/route.ts`
- `app/api/admin/users/route.ts`, `app/api/admin/users/[id]/route.ts`
- `app/api/admin/me/route.ts`
- `app/api/admin/audit/route.ts`
- `app/api/admin/upload/route.ts`
- `app/api/admin/webauthn/register/options/route.ts`, `register/verify/route.ts`, `login/options/route.ts`, `login/verify/route.ts`, `credentials/[id]/route.ts`
- `app/admin/users/page.tsx`, `app/admin/account/page.tsx`, `app/admin/audit/page.tsx`

**Modificados**
- `app/lib/auth.ts` — helpers de permisos (`requireAuth`/`requireOwner`); soporte de token `setup`.
- `app/api/admin/auth/route.ts` — login multiusuario.
- `app/admin/login/page.tsx` — setup modal + pestaña WebAuthn.
- `app/admin/components/AdminSidebar.tsx` — entradas Users/Audit, perfil, mensajes.
- `package.json`, `.env.example`, `README.md`.

---

## 9. Criterios de aceptación
1. Un owner puede crear un usuario y obtener su OTP.
2. El usuario nuevo hace setup por OTP y fija contraseña o llave; luego entra.
3. Roles aplicados: admin no puede crear/eliminar usuarios; owner/root sí.
4. Acciones (suspend/unsuspend/resetOtp/sendMessage/delete) funcionan y se registran en el audit log.
5. Un usuario puede registrar una llave WebAuthn en su cuenta y usarla para iniciar sesión (flujo options/verify operativo).
6. `/admin/account` permite editar perfil y cambiar contraseña.
7. `/admin/audit` muestra el historial buscable.
8. `npm run build` pasa; el panel sigue con tema morado/azul; root sigue funcionando.
