'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { BANNER, processCommand, COMMANDS, THEMES } from '@/lib/terminal';
import { toAscii, loadImageToCanvas } from '@/lib/ascii';

interface Entry {
  type: 'input' | 'output' | 'banner';
  text: string;
}

interface TerminalPanelProps {
  active: boolean;
  onClose: () => void;
  onNavigate?: (section: string) => void;
  onBackToNav: () => void;
}

// Colorization utility
function colorizeOutput(text: string): React.ReactNode {
  const keywords = [
    { pattern: /\b(open|curl)\b/gi, color: '#22c55e' },
    { pattern: /\b(Congrats|found)\b/gi, color: '#fbbf24' },
    { pattern: /\b(error|denied|denied:|Error|ERROR)\b/gi, color: '#ef4444' },
    { pattern: /\b(HTB|HTB\{[^}]*\})\b/gi, color: '#06b6d4' },
    { pattern: /\b(s7lver)\b/gi, color: '#a78bfa' },
  ];

  let result: React.ReactNode[] = [];
  let lastIndex = 0;

  keywords.forEach((kw) => {
    let match;
    const tempResult: React.ReactNode[] = [];
    let tempLastIndex = 0;

    const regex = new RegExp(kw.pattern.source, kw.pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      if (match.index > tempLastIndex) {
        tempResult.push(text.slice(tempLastIndex, match.index));
      }
      tempResult.push(
        <span key={`${match.index}-${kw.color}`} style={{ color: kw.color }}>
          {match[0]}
        </span>
      );
      tempLastIndex = match.index + match[0].length;
    }

    if (tempLastIndex > 0) {
      if (tempLastIndex < text.length) {
        tempResult.push(text.slice(tempLastIndex));
      }
      text = text; // unchanged, but we'll use tempResult instead
      result = tempResult;
    }
  });

  return result.length > 0 ? result : text;
}

// Ghost autocomplete
function ghostAutocomplete(input: string): string {
  const lower = input.trim().toLowerCase();
  if (!lower) return '';
  const matches = COMMANDS.filter((cmd) => cmd.startsWith(lower));
  return matches.length === 1 ? matches[0] : '';
}

export default function TerminalPanel({
  active,
  onClose,
  onNavigate,
  onBackToNav,
}: TerminalPanelProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Entry[]>([
    { type: 'banner', text: BANNER },
  ]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [matrix, setMatrix] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-focus on active
  useEffect(() => {
    if (active) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [active]);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Quick command chips: 8 commands
  const quickCommands = ['whoami', 'ls -la', 'cat flag.txt', 'nmap localhost', 'skills', 'neofetch', 'hack', 'help'];

  // Handle matrix effect
  useEffect(() => {
    if (!matrix) return;

    const canvas = document.getElementById('matrix-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Setup
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(columns).fill(0);
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

    const draw = () => {
      ctx.fillStyle = 'rgba(10, 10, 10, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00ff00';
      ctx.font = `${fontSize}px JetBrains Mono`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 50);
    const timeout = setTimeout(() => {
      setMatrix(false);
      clearInterval(interval);
    }, 2600);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [matrix]);

  // Process command and handle sentinels
  const handleCommand = useCallback(
    (raw: string) => {
      const result = processCommand(raw, onNavigate);

      // Handle sentinels
      if (result === '__CLEAR__') {
        setHistory([{ type: 'banner', text: BANNER }]);
      } else if (result === '__EXIT__') {
        onClose();
      } else if (result === '__NAVIGATE__') {
        setHistory((h) => [
          ...h,
          { type: 'input', text: raw },
        ]);
        setTimeout(() => onClose(), 300);
      } else if (result === '__MATRIX__') {
        setHistory((h) => [
          ...h,
          { type: 'input', text: raw },
          { type: 'output', text: 'Matrix rain initiated...' },
        ]);
        setMatrix(true);
      } else if (result.startsWith('__NEOFETCH__')) {
        // Render neofetch with image (async)
        const output = result.replace('__NEOFETCH__', '').trim();
        setHistory((h) => [
          ...h,
          { type: 'input', text: raw },
          { type: 'output', text: output },
        ]);
        // TODO: Handle image ASCII rendering if needed
      } else if (result.startsWith('__THEME__:')) {
        const themeName = result.split(':')[1];
        const theme = THEMES[themeName];
        if (theme) {
          const [textColor, accentColor] = theme;
          document.documentElement.style.setProperty('--brand-1', textColor);
          document.documentElement.style.setProperty('--brand-2', accentColor);
        }
        setHistory((h) => [
          ...h,
          { type: 'input', text: raw },
          { type: 'output', text: `Theme ${themeName} applied.` },
        ]);
      } else {
        setHistory((h) => [
          ...h,
          { type: 'input', text: raw },
          ...(result ? [{ type: 'output' as const, text: result }] : []),
        ]);
      }

      if (raw.trim()) {
        setCmdHistory((h) => [raw, ...h]);
      }
      setHistoryIdx(-1);
      setInput('');
    },
    [onNavigate, onClose]
  );

  // Handle submit
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const raw = input.trim();
      if (raw) handleCommand(raw);
    },
    [input, handleCommand]
  );

  // Handle keyboard events
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
        const suggestion = ghostAutocomplete(input);
        if (suggestion && suggestion !== input.trim().toLowerCase()) {
          setInput(suggestion + ' ');
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onBackToNav();
      }
    },
    [cmdHistory, input, onBackToNav]
  );

  // Quick chip handler
  const handleQuickChip = (cmd: string) => {
    setInput(cmd);
    setTimeout(() => {
      handleCommand(cmd);
    }, 50);
  };

  const ghost = ghostAutocomplete(input);

  return (
    <div className="ccterm">
      {/* Matrix canvas overlay (hidden by default) */}
      {matrix && (
        <canvas
          id="matrix-canvas"
          className="term-matrix"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            borderRadius: '8px',
            background: '#0a0a0a',
          }}
        />
      )}

      {/* Terminal scroll area */}
      <div className="term">
        {/* Output history */}
        <div className="term-output">
          {history.map((entry, i) => {
            if (entry.type === 'banner') {
              return (
                <pre key={i} className="term-banner">
                  {entry.text}
                </pre>
              );
            }
            if (entry.type === 'input') {
              return (
                <div key={i} className="term-input-line">
                  <span className="term-prompt">s7lver@portfolio:~$</span>
                  <span className="term-input-text">{entry.text}</span>
                </div>
              );
            }
            return (
              <pre key={i} className="term-output-text">
                {colorizeOutput(entry.text)}
              </pre>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Quick command chips */}
        <div className="term-chips">
          {quickCommands.map((cmd) => (
            <button
              key={cmd}
              className="chip"
              onClick={() => handleQuickChip(cmd)}
            >
              $ {cmd}
            </button>
          ))}
        </div>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="termin">
        <span className="term-prompt-inline">s7lver@portfolio:~$</span>
        <div className="term-input-wrapper">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            className="term-input-field"
            placeholder="type a command..."
            autoComplete="off"
            spellCheck={false}
          />
          {/* Ghost autocomplete suggestion */}
          {ghost && (
            <span className="term-ghost">{ghost.slice(input.length)}</span>
          )}
        </div>
        <span className="term-cursor" />
      </form>

      {/* Footer hints */}
      <div className="palfoot">
        <span>↑↓ history</span>
        <span>tab autocomplete</span>
        <span>esc back</span>
      </div>
    </div>
  );
}
