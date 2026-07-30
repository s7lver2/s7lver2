import { NextResponse } from 'next/server';
import { getSettings } from '@/app/lib/settings';

// Sin esto, Next 14 ve un GET() sin argumentos, decide que es estatico y lo
// ejecuta durante el build — donde no hay Redis y el fetch falla. El CDN ya
// cachea via el s-maxage de abajo, asi que no perdemos nada haciendola dinamica.
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({ flags: s.flags, theme: s.theme }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
  });
}
