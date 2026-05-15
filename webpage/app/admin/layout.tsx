// webpage/app/admin/layout.tsx
import type { ReactNode } from 'react';
import Sidebar from './components/Sidebar';

export const metadata = { title: 's7lver — admin' };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: 'rgb(6,3,12)',
      color: '#e9d5ff',
    }}>
      <Sidebar />
      <main style={{
        flex: 1, padding: '32px 28px',
        overflowY: 'auto',
        fontFamily: 'var(--font-mono), monospace',
      }}>
        {children}
      </main>
    </div>
  );
}