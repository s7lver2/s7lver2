'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { FaTimes } from 'react-icons/fa';

// ── ASCII banner ───────────────────────────────────────────────────────
const BANNER = `
 _____ _____                 
|   __|___  |___ _ _ ___ ___ 
|__   |_  | | -_| | | -_|  _|
|_____|___|_|___|___| _|_|  
               |_|          

s7lver@portfolio ~ zsh
Type 'help' for available commands.
`;

// ── Command processor ──────────────────────────────────────────────────
function processCommand(raw: string): string {
  const input = raw.trim();
  const lower = input.toLowerCase();
  const [cmd, ...args] = lower.split(' ');

  switch (cmd) {
    case 'help':
      return `
Available commands:
  whoami          → Operator profile
  ls [-la]        → List sections
  cat <file>      → Read a file
  nmap localhost  → Scan this host
  ping <host>     → Ping a host
  skills          → Cybersecurity skills
  sudo <cmd>      → Try your luck
  hack            → Initialize hack sequence
  uname -a        → System info
  history         → Command history
  clear           → Clear terminal
  exit            → Close terminal
      `;
    case 'whoami':
      return `s7lver
uid=1337(s7lver) gid=1337(hackers) groups=1337(hackers),0(root)
Role:   Developer & Cybersecurity Student
Focus:  Pentesting · CTF · Red Team
HTB:    Hacker Rank | user s7lver
`;
    case 'ls':
      return args[0] === '-la' || args[0] === '-l'
        ? `total 5
drwxr-xr-x  s7lver  s7lver  about/
drwxr-xr-x  s7lver  s7lver  skills/
drwxr-xr-x  s7lver  s7lver  projects/
drwxr-xr-x  s7lver  s7lver  htb/
drwxr-xr-x  s7lver  s7lver  contact/`
        : 'about/  skills/  projects/  htb/  contact/';

    case 'cat':
      if (!args[0]) return 'cat: missing file operand. Try: cat flag.txt, cat about.txt';
      if (args[0] === 'flag.txt') return `
Congrats. You found it.

HTB{y0u_f0und_th3_s3cr3t_t3rm1n4l_3gg}

Keep hacking. 🚩`;
      if (args[0] === 'about.txt') return `Name:     s7lver
Role:     Developer & Cybersec Student
Stack:    Go · Rust · TypeScript · Python
Projects: ZephyrOS · tsuki · file-meet · CodeDotJS
Contact:  nickespro130@outlook.es`;
      if (args[0] === '/etc/passwd') return `root:x:0:0:root:/root:/bin/bash
s7lver:x:1337:1337::/home/s7lver:/bin/zsh
visitor:x:9999:9999::/dev/null:/bin/false`;
      if (args[0] === '/etc/shadow') return 'Permission denied: you wish 😂';
      return `cat: ${args[0]}: No such file or directory`;

    case 'nmap':
      return `Starting Nmap 7.94 ( https://nmap.org )
Nmap scan report for s7lver.dev
Host is up (0.0001s latency).

PORT     STATE  SERVICE  VERSION
22/tcp   open   ssh      OpenSSH 9.0
80/tcp   open   http     Next.js 15
443/tcp  open   https    Next.js 15
3000/tcp closed dev-mode

OS: Portfolio Linux 6.6-s7lver
Scanned in 2.13 seconds`;

    case 'ping':
      const host = args[0] || 'localhost';
      return `PING ${host}: 56 bytes
64 bytes: icmp_seq=0 ttl=63 time=42.0 ms
64 bytes: icmp_seq=1 ttl=63 time=41.8 ms
64 bytes: icmp_seq=2 ttl=63 time=42.3 ms
3 packets transmitted, 3 received, 0% packet loss`;

    case 'skills':
      return `[RED TEAM]  Metasploit · Burp Suite · SQLMap · Hydra · Mimikatz
[CTF]       Buffer Overflow · Rev Eng · Web Exploitation · Ghidra
[RECON]     Nmap · Wireshark · Gobuster · Subfinder · Responder`;

    case 'sudo':
      if (args.join(' ') === 'rm -rf /' || args.join(' ') === 'rm -rf /*')
        return '[ NICE TRY ] Portfolio is read-only 😏';
      return `[sudo] password for visitor: 
Sorry, try again.
[sudo] password for visitor: 
sudo: 3 incorrect password attempts`;

    case 'hack':
      return `Initializing hack sequence...
[████████████████████] 100%

ERROR: Target is s7lver himself.
Recursion detected. Cannot hack the hacker. Aborting.`;

    case 'uname':
      return `Linux portfolio 6.6.0-s7lver #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux
Built with Next.js 15 & pure chaos`;

    case 'history':
      return `    1  whoami
    2  ls -la
    3  cat flag.txt
    4  sudo rm -rf /
    5  nmap localhost
    6  hack`;

    case 'clear':
      return '__CLEAR__';
    case 'exit':
      return '__EXIT__';
    case '':
      return '';
    default:
      return `bash: ${cmd}: command not found\nType 'help' for available commands.`;
  }
}

// ── Component ──────────────────────────────────────────────────────────
interface TerminalProps {
  open: boolean;
  onClose: () => void;
}

export default function Terminal({ open, onClose }: TerminalProps) {
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
      const result = processCommand(raw || '');

      if (result === '__CLEAR__') {
        setHistory([{ type: 'banner', text: BANNER }]);
      } else if (result === '__EXIT__') {
        onClose();
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
    [input, onClose]
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
    },
    [cmdHistory]
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