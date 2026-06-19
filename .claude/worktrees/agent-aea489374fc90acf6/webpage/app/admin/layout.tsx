import type { Metadata } from 'next';
import { headers } from 'next/headers';
import AdminSidebar from './components/AdminSidebar';

export const metadata: Metadata = {
  title: { default: 'admin • s7lver', template: '%s • admin' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get('x-pathname') ?? '';
  const isLogin = pathname.startsWith('/admin/login');

  if (isLogin) return <>{children}</>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1, background: '#05000a' }}>
      <AdminSidebar />
      <main className="admin-main" style={{
        flex: 1, minWidth: 0, marginLeft: 200, padding: '24px', overflowX: 'hidden',
      }}>
        {children}
      </main>
      <style>{`
        @media (max-width: 768px) {
          .admin-main { margin-left: 0 !important; padding: 64px 14px 40px !important; }
          .admin-sidebar-desktop { display: none !important; }
        }
      `}</style>
    </div>
  );
}
