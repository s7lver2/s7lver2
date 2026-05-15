// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import ScrollReveal from '@/components/ScrollReveal';
import StarField from '@/components/StarField';

export const metadata: Metadata = {
  title: 's7lver',
  description: 'Developer & Creator',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Campo de estrellas fijo — base de toda la web */}
        <StarField />
        <ScrollReveal />
        {/* Contenido encima del starfield */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  );
}