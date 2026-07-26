'use client';

import { useEffect, useState } from 'react';
import AdminPalette, { ROOT_COMMAND_COUNT } from './AdminPalette';
import StatusLine from './StatusLine';

export { ROOT_COMMAND_COUNT };

export default function PaletteHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey);
      if (isK) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // Do not fire while a text input has focus, unless the palette itself
      // is open (so esc/arrows still work inside it).
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (!open && (tag === 'input' || tag === 'textarea')) return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <StatusLine commandCount={ROOT_COMMAND_COUNT} />
      <AdminPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
