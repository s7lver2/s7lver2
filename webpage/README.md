# Portfolio s7lver2

Portfolio personal minimalista y profesional construido con Next.js, TypeScript y Tailwind CSS.

## 🎨 Características

- Diseño minimalista inspirado en Vercel
- Colores: Negro, blanco, morado y azul
- Degradados elegantes para resaltes
- Animaciones suaves y profesionales
- Formas geométricas con bordes iluminados
- Tarjetas con efecto glow
- Totalmente responsive
- Optimizado para rendimiento

## 🚀 Tecnologías Utilizadas

- **Next.js 14** - Framework de React
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos utility-first
- **React Icons** - Iconos para tecnologías y redes sociales
- **Google Fonts** - JetBrains Mono y Sora

## 📦 Instalación

1. Asegúrate de tener Node.js instalado (versión 18 o superior)

2. Instala las dependencias:
```bash
npm install
# o
yarn install
# o
pnpm install
```

3. Configura las variables de entorno (`.env.local`):
```
GITHUB_USERNAME=tu_usuario_github
# Opcional: para mayor límite de rate limit de GitHub API
GITHUB_TOKEN=tu_token_github
```

4. Inicia el servidor de desarrollo:
```bash
npm run dev
# o
yarn dev
# o
pnpm dev
```

5. Abre [http://localhost:3000](http://localhost:3000) en tu navegador

## 🏗️ Estructura del Proyecto

```
portfolio/
├── app/
│   ├── globals.css       # Estilos globales y clases personalizadas
│   ├── layout.tsx        # Layout principal con fuentes
│   └── page.tsx          # Página principal con todas las secciones
├── public/               # Archivos estáticos (opcional)
├── tailwind.config.ts    # Configuración de Tailwind con colores personalizados
├── tsconfig.json         # Configuración de TypeScript
├── next.config.js        # Configuración de Next.js
└── package.json          # Dependencias del proyecto
```

## 🎯 Secciones

1. **Hero Section** - Presentación con nombre y tecnologías
2. **Tech Stack** - Grid de tecnologías que dominas
3. **Proyectos** - Tarjetas con tus proyectos destacados de GitHub
4. **GitHub** - Información de perfil (requiere `GITHUB_USERNAME` configurada)
5. **Redes Sociales** - Enlaces a todas tus redes
6. **Footer** - Cita inspiradora y email de contacto

## ⌨️ Keyboard Shortcuts

- **⌘K / Ctrl+K** - Abre la paleta de comandos (búsqueda de secciones)
- **`` ` `` (acento grave)** - Abre el terminal interactivo

## 🔧 Variables de Entorno

### Requeridas
- **GITHUB_USERNAME** - Tu nombre de usuario en GitHub. Necesario para cargar la sección de GitHub con información de perfil.

### Opcionales
- **GITHUB_TOKEN** - Token de acceso personal de GitHub (Fine-grained tokens recomendado). Aumenta el límite de rate limit de la API de GitHub de 60 a 5000 requests/hora. [Crear token](https://github.com/settings/tokens)

- `GITHUB_USER` — **must be `s7lver2`** in Vercel. A stale `GITHUB_USERNAME=s7lver`
  points at an account with 0 public repos and every GitHub KPI reads zero.
- `HTB_API_TOKEN`, `HTB_USER_ID` — optional. Absent, the HackTheBox section
  renders its empty state instead of disappearing.

Crear archivo `.env.local` en la raíz del proyecto:
```
GITHUB_USERNAME=tu_usuario_github
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

## 🛠️ Personalización

### Cambiar colores
Edita el archivo `tailwind.config.ts`:
```typescript
colors: {
  primary: {
    purple: '#8b5cf6',  // Tu color morado
    blue: '#3b82f6',    // Tu color azul
  },
}
```

### Modificar proyectos
Edita el array `projects` en `app/page.tsx`:
```typescript
const projects = [
  {
    title: 'Tu Proyecto',
    description: 'Descripción...',
    tech: ['Tech1', 'Tech2'],
    link: 'https://github.com/...',
    status: 'Estado'
  },
  // ...
];
```

### Actualizar redes sociales
Edita el array `socials` en `app/page.tsx`:
```typescript
const socials = [
  { 
    icon: <FaGithub />, 
    name: 'GitHub', 
    handle: '@tuusuario', 
    link: 'https://github.com/tuusuario' 
  },
  // ...
];
```

## 📱 Deploy

### Vercel (Recomendado)
1. Sube tu código a GitHub
2. Importa el repositorio en [Vercel](https://vercel.com)
3. Vercel detectará automáticamente Next.js y configurará todo

### Netlify
1. Sube tu código a GitHub
2. Conecta tu repositorio en [Netlify](https://netlify.com)
3. Build command: `npm run build`
4. Publish directory: `.next`

### Build para producción
```bash
npm run build
npm start
```

## 📊 Admin Panel (Phase 2 + Phase 3)

El portfolio incluye un panel de analytics y gestión de usuarios en `/admin`.

### Acceso
Navega a `/admin/login` e ingresa la contraseña configurada en `ROOT_PASSWORD`.
Los usuarios no-root reciben un OTP de primer acceso generado por el root.

### Variables de entorno
```
ADMIN_SECRET=cambiar_a_string_largo_aleatorio
ROOT_PASSWORD=cambiar_esto
# Storage (opcional; sin Redis los datos son efímeros en Vercel)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
# WebAuthn (Phase 3)
NEXT_PUBLIC_SITE_URL=https://tu-dominio
# Avatar/banner uploads con Vercel Blob (Phase 3, opcional)
BLOB_READ_WRITE_TOKEN=
```

### Tracking
El tracking de visitas está habilitado por defecto. Las páginas `/admin/*` no se rastrean.
Sin Upstash Redis, los datos se guardan en `data/` (local) o `/tmp` (Vercel, efímero).

### Dashboard (Phase 2)
- `/admin` — Overview con KPIs, gráficos y sessions recientes
- `/admin/traffic` — Heatmap de actividad y análisis de fuentes
- `/admin/live` — Actividad en tiempo real via SSE

### Usuarios y seguridad (Phase 3)
- `/admin/users` — Gestión de usuarios (solo root): crear, suspender, resetear OTP, eliminar
- `/admin/account` — Perfil propio: avatar, bio, passkeys WebAuthn
- `/admin/audit` — Log de auditoría paginado (últimas 2000 acciones)

## 💡 Mejoras Futuras

- [ ] Agregar modo claro/oscuro
- [ ] Implementar animaciones más complejas con Framer Motion
- [ ] Agregar un blog integrado
- [ ] Sistema de comentarios
- [ ] Formulario de contacto funcional

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 👨‍💻 Autor

**s7lver2**
- GitHub: [@s7lver2](https://github.com/s7lver2)
- Email: nickespro130@outlook.es
- Twitter: [@not_s7lver](https://twitter.com/not_s7lver)

---

Hecho con ❤️ usando Next.js, TypeScript y Tailwind CSS
