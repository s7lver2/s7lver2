import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { notFound } from 'next/navigation';
import Gallery from './Gallery';

// solo para depurar: todos los modelos de public/models, flotando, para mirarlos de cerca
export const dynamic = 'force-dynamic';

function glbs(dir: string, url: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === 'src' ? [] : glbs(join(dir, e.name), `${url}${e.name}/`)) : e.name.endsWith('.glb') ? [url + e.name] : [],
  );
}

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  // la carpeta sale de una variable: así el empaquetado de Vercel no la sigue y no mete todos los
  // modelos dentro de la función (esta página solo existe en desarrollo)
  const dir = process.env.GALLERY_DIR || 'public/models';
  return <Gallery urls={glbs(join(process.cwd(), dir), '/models/')} />;
}
