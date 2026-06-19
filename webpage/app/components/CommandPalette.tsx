'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { FaTimes, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { buildCommands, filterCommands, type Command, type CommandContext } from '@/lib/commands';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenTerminal: () => void;
}

export default function CommandPalette({ open, onClose, onOpenTerminal }: CommandPaletteProps) {
  const [input, setInput] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [commands, setCommands] = useState<Command[]>([]);
  const [filtered, setFiltered] = useState<Command[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Build commands on mount
  useEffect(() => {
    const ctx: CommandContext = { openTerminal: onOpenTerminal, close: onClose };
    const cmds = buildCommands(ctx);
    setCommands(cmds);
    setFiltered(cmds);
  }, [onClose, onOpenTerminal]);

  // Auto-focus input on open
  useEffect(() => {
    if (open) {
      setInput('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Handle input change and filter
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInput(val);
      setSelectedIdx(0);
      setFiltered(filterCommands(commands, val));
    },
    [commands]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIdx]) {
          filtered[selectedIdx].run({ openTerminal: onOpenTerminal, close: onClose });
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIdx, onOpenTerminal, onClose]
  );

  // Auto-scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedIdx]);

  // Close on Escape (global)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Palette window */}
      <div
        className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl transition-all duration-200 ease-out ${
          open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="mx-auto max-w-2xl px-4">
          <div className="rounded-xl border border-white/10 bg-[#0f0f0f]/98 backdrop-blur-xl shadow-2xl shadow-black/80 overflow-hidden">
            {/* Input section */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <span className="text-gray-400 text-sm">
                <span className="text-primary-purple">⌘</span>K
              </span>
              <input
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600 caret-primary-purple"
                placeholder="Search commands..."
                autoComplete="off"
                spellCheck={false}
              />
              {input && (
                <button
                  onClick={() => {
                    setInput('');
                    setFiltered(commands);
                    setSelectedIdx(0);
                  }}
                  className="text-gray-600 hover:text-gray-400 transition-colors"
                >
                  <FaTimes className="text-xs" />
                </button>
              )}
            </div>

            {/* Commands list */}
            <div
              ref={listRef}
              className="max-h-96 overflow-y-auto"
            >
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-600 text-sm">
                  No commands found.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filtered.map((cmd, idx) => (
                    <button
                      ref={idx === selectedIdx ? selectedRef : null}
                      key={cmd.id}
                      onClick={() => {
                        cmd.run({ openTerminal: onOpenTerminal, close: onClose });
                      }}
                      className={`w-full px-4 py-3 text-left text-sm transition-colors flex items-center justify-between ${
                        idx === selectedIdx
                          ? 'bg-primary-purple/20 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>{cmd.label}</span>
                      {cmd.hint && (
                        <span className="text-xs text-gray-600 font-mono">
                          {cmd.hint}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer with hints */}
            {filtered.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-white/[0.01] text-xs text-gray-600 font-mono">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <FaArrowUp className="text-[10px]" />
                    <FaArrowDown className="text-[10px]" />
                    to navigate
                  </span>
                  <span>⏎ to execute</span>
                  <span>Esc to close</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
