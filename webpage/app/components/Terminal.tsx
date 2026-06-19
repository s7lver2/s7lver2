'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { FaTimes } from 'react-icons/fa';
import { BANNER, processCommand, COMMANDS } from '@/lib/terminal';

// ── Component ──────────────────────────────────────────────────────────
interface TerminalProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: (section: string) => void;
}

export default function Terminal({ open, onClose, onNavigate }: TerminalProps) {
  const [input, setInput]       = useState('');
  const [history, setHistory]   = useState<{ type: 'input' | 'output' | 'banner'; text: string }[]>([
    { type: 'banner', text: BANNER },
  ]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const endRef   = useRef<HTMLDivElement>(null);

  // Auto-focus on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Backtick / Escape shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;
      if (e.key === '`') onClose(); // toggle handled by parent
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const raw = input.trim();
      const result = processCommand(raw || '', onNavigate);

      if (result === '__CLEAR__') {
        setHistory([{ type: 'banner', text: BANNER }]);
      } else if (result === '__EXIT__') {
        onClose();
      } else if (result === '__NAVIGATE__') {
        setHistory((h) => [
          ...h,
          { type: 'input', text: raw || '' },
        ]);
        // onNavigate was already called by processCommand
        setTimeout(() => onClose(), 300);
      } else {
        setHistory((h) => [
          ...h,
          { type: 'input', text: raw || '' },
          ...(result ? [{ type: 'output' as const, text: result }] : []),
        ]);
      }

      if (raw) setCmdHistory((h) => [raw, ...h]);
      setHistoryIdx(-1);
      setInput('');
    },
    [input, onClose, onNavigate]
  );

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHistoryIdx((i) => {
          const next = Math.min(i + 1, cmdHistory.length - 1);
          setInput(cmdHistory[next] ?? '');
          return next;
        });
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHistoryIdx((i) => {
          const next = Math.max(i - 1, -1);
          setInput(next === -1 ? '' : (cmdHistory[next] ?? ''));
          return next;
        });
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const currentInput = input.trim().toLowerCase();
        // Filter commands that start with current input
        const matches = COMMANDS.filter((cmd) => cmd.startsWith(currentInput));
        // If exactly one match, autocomplete it
        if (matches.length === 1) {
          setInput(matches[0] + ' ');
        }
      }
    },
    [cmdHistory, input]
  );

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Window */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[100] transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '60vh' }}
      >
        <div className="mx-auto max-w-4xl px-4 pb-4">
          <div
            className="rounded-t-2xl border border-white/10 bg-[#0a0a0a]/98 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/80 flex flex-col"
            style={{ maxHeight: '58vh' }}
          >
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.02] shrink-0">
              <button
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors"
              />
              <div className="w-3 h-3 rounded-full bg-yellow-500/40" />
              <div className="w-3 h-3 rounded-full bg-green-500/40" />
              <span className="ml-3 text-xs text-gray-500 font-mono flex-1 text-center">
                s7lver@portfolio ~ zsh
              </span>
              <button onClick={onClose} className="text-gray-600 hover:text-gray-400">
                <FaTimes className="text-xs" />
              </button>
            </div>

            {/* Output */}
            <div
              className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1"
              onClick={() => inputRef.current?.focus()}
            >
              {history.map((entry, i) => {
                if (entry.type === 'banner') {
                  return (
                    <pre
                      key={i}
                      className="text-green-500/70 text-[9px] sm:text-[11px] leading-tight whitespace-pre overflow-x-auto mb-2"
                    >
                      {entry.text}
                    </pre>
                  );
                }
                if (entry.type === 'input') {
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-green-400 shrink-0 select-none">s7lver@portfolio:~$</span>
                      <span className="text-white break-all">{entry.text}</span>
                    </div>
                  );
                }
                return (
                  <pre key={i} className="text-gray-400 whitespace-pre-wrap leading-relaxed">
                    {entry.text}
                  </pre>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 px-4 py-3 border-t border-white/10 bg-white/[0.02] shrink-0"
            >
              <span className="text-green-400 font-mono text-sm shrink-0 select-none">
                s7lver@portfolio:~$
              </span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                className="flex-1 bg-transparent text-white font-mono text-sm outline-none caret-green-400 placeholder-gray-700"
                placeholder="type a command..."
                autoComplete="off"
                spellCheck={false}
              />
              <span className="w-2 h-4 bg-green-400 animate-pulse opacity-60" />
            </form>
          </div>
        </div>
      </div>
    </>
  );
}