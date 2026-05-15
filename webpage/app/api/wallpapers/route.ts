// app/api/wallpapers/route.ts
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'];

export async function GET() {
  const wallpapersDir = path.join(process.cwd(), 'public', 'wallpapers');

  let files: string[] = [];
  try {
    files = fs.readdirSync(wallpapersDir).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return VALID_EXTENSIONS.includes(ext);
    });
  } catch {
    // Directory doesn't exist yet — return empty list gracefully
    files = [];
  }

  return NextResponse.json({ wallpapers: files });
}