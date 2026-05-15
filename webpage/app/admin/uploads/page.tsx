// webpage/app/admin/uploads/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface BlobFile { url: string; pathname: string; size: number; uploadedAt: string; }

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadsPage() {
  const router = useRouter();
  const [files, setFiles] = useState<BlobFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    const res = await fetch('/api/admin/files');
    if (res.status === 401) { router.push('/admin/login'); return; }
    const data = await res.json();
    setFiles(data);
    setLoading(false);
  };

  useEffect(() => { loadFiles(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(`uploading ${file.name}…`);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    setUploading(false);
    if (res.ok) {
      setUploadProgress(`✓ uploaded`);
      setTimeout(() => setUploadProgress(''), 2000);
      await loadFiles();
    } else {
      setUploadProgress('✗ upload failed');
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDelete = async (url: string, pathname: string) => {
    if (!confirm(`Delete ${pathname}?`)) return;
    await fetch('/api/admin/files', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    setFiles(f => f.filter(file => file.url !== url));
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 26, color: '#e9d5ff', lineHeight: 1.1 }}>uploads</div>
        <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(233,213,255,0.3)', letterSpacing: '0.1em', marginTop: 4, textTransform: 'uppercase' }}>file manager · vercel blob</div>
      </div>

      {/* Upload zone */}
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: '2px dashed rgba(139,92,246,0.25)', borderRadius: 12,
          padding: '32px', textAlign: 'center', marginBottom: 20,
          cursor: 'pointer', transition: 'all 0.2s',
          background: 'rgba(139,92,246,0.03)',
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (!file) return;
          const dt = new DataTransfer();
          dt.items.add(file);
          if (inputRef.current) { inputRef.current.files = dt.files; handleUpload({ target: inputRef.current } as any); }
        }}
      >
        <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
        <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 24, color: 'rgba(139,92,246,0.4)', marginBottom: 8 }}>⬆</div>
        <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11, color: 'rgba(233,213,255,0.5)', letterSpacing: '0.08em' }}>
          {uploading ? uploadProgress : uploadProgress || 'click or drag a file to upload (max 50MB)'}
        </div>
      </div>

      {/* File list */}
      {loading ? (
        <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, color: 'rgba(233,213,255,0.3)', textAlign: 'center', padding: 40 }}>loading…</div>
      ) : files.length === 0 ? (
        <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, color: 'rgba(233,213,255,0.25)', textAlign: 'center', padding: 40 }}>no files yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(file => {
            const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.pathname);
            const name = file.pathname.replace('uploads/', '');
            return (
              <div key={file.url} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)', borderRadius: 10 }}>
                {/* Preview */}
                <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', background: 'rgba(139,92,246,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isImage
                    ? <img src={file.url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 16 }}>📄</span>
                  }
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11, color: '#e9d5ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(233,213,255,0.3)', marginTop: 2 }}>
                    {fmtSize(file.size)} · {new Date(file.uploadedAt).toLocaleDateString()}
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => handleCopy(file.url)} style={{ padding: '5px 10px', background: 'none', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 6, fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: copied === file.url ? '#86efac' : 'rgba(233,213,255,0.5)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {copied === file.url ? '✓ copied' : 'copy URL'}
                  </button>
                  <a href={file.url} target="_blank" rel="noreferrer" style={{ padding: '5px 10px', background: 'none', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 6, fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(233,213,255,0.5)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                    open
                  </a>
                  <button onClick={() => handleDelete(file.url, file.pathname)} style={{ padding: '5px 10px', background: 'none', border: '1px solid rgba(196,20,40,0.2)', borderRadius: 6, fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: 'rgba(248,113,113,0.5)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}