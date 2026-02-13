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

3. Inicia el servidor de desarrollo:
```bash
npm run dev
# o
yarn dev
# o
pnpm dev
```

4. Abre [http://localhost:3000](http://localhost:3000) en tu navegador

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
4. **Redes Sociales** - Enlaces a todas tus redes
5. **Footer** - Cita inspiradora y email de contacto

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

## 💡 Mejoras Futuras

- [ ] Agregar modo claro/oscuro
- [ ] Implementar animaciones más complejas con Framer Motion
- [ ] Agregar un blog integrado
- [ ] Sistema de comentarios
- [ ] Analytics integrado
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
