import type { Metadata } from 'next';
import { headers } from 'next/headers';
import AdminSidebar from './components/AdminSidebar';
import { DirtyProvider } from './components/ui';
import StatusLine from './components/StatusLine';
import ToastHost from './components/ToastHost';

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
    <DirtyProvider>
      <div style={{ display: 'flex', minHeight: '100vh', position: 'relative', zIndex: 1, background: '#05000a' }}>
        <AdminSidebar />
        <main className="admin-main" style={{
          flex: 1, minWidth: 0, marginLeft: 200, padding: '24px', paddingBottom: 30, overflowX: 'hidden',
        }}>
          {children}
        </main>
        <StatusLine commandCount={0} />
        <ToastHost />
        <style>{`
          @media (max-width: 768px) {
            .admin-main { margin-left: 0 !important; padding: 64px 14px 40px !important; padding-bottom: 30px !important; }
            .admin-sidebar-desktop { display: none !important; }
          }
        `}</style>
      </div>
    </DirtyProvider>
  );
}
