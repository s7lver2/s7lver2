'use client';
import { useEffect, useRef, useState } from 'react';
import type { DeskNode } from '@/app/lib/content-constants';
import type { PcAudio } from './pcAudio';

/*
 * tty0: al abrirse se conecta solo y deja corriendo el log de lo que hace la máscara. Si
 * escribes, el log se corta (^C) y la terminal responde de verdad a unos pocos comandos.
 */

const BOOT: [string, string][] = [
  ['$ ', 'ssh oni@203.0.113.7'],
  ['', 'connected. key fingerprint 3a:0c:7f:e1:9b'],
  ['$ ', 'tail -f /var/log/ghost'],
];
const LOG = (user: string) => [
  'pid 7   wake      mask',
  'pid 7   watch     /dev/cam0',
  'pid 13  listen    radio 88.7',
  `pid 7   stare     ${user}`,
  'pid 21  copy      ~/projects',
  'pid 7   whisper   "are you still awake?"',
  'pid 13  static    ch07',
  'pid 7   smile',
];
const stamp = () => {
  const d = new Date();
  return `[${[d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')}]`;
};

export default function Terminal({ audio, user, items, active }: { audio: PcAudio; user: string; items: DeskNode[]; active: boolean }) {
  const [lines, setLines] = useState<string[]>([]);
  const [typing, setTyping] = useState(''); // lo que el script está tecleando
  const [tailing, setTailing] = useState(true);
  const [cmd, setCmd] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const push = (...l: string[]) => setLines((ls) => [...ls, ...l].slice(-300));

  // el guion: teclea la conexión y luego el log va saliendo
  useEffect(() => {
    if (!tailing) return;
    let alive = true, t = 0;
    const wait = (ms: number) => new Promise<void>((r) => (t = window.setTimeout(r, ms)));
    (async () => {
      if (!lines.length)
        for (const [pr, txt] of BOOT) {
          if (pr) {
            for (let i = 1; i <= txt.length && alive; i++) {
              setTyping(pr + txt.slice(0, i));
              audio.key();
              await wait(45 + Math.random() * 80);
            }
            setTyping('');
          }
          if (!alive) return;
          push(pr + txt);
          await wait(400 + Math.random() * 500);
        }
      const log = LOG(user);
      for (let i = 0; alive; i++) {
        push(`${stamp()} ${log[i % log.length]}`);
        await wait(1400 + Math.random() * 2400);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tailing]);

  useEffect(() => {
    // quien hace scroll es el cuerpo de la ventana, no la terminal
    const box = body.current?.parentElement;
    box?.scrollTo(0, box.scrollHeight);
  }, [lines, typing, cmd]);

  // el virus escala privilegios delante de ti
  useEffect(() => {
    const v = () => push(`${stamp()} pid 7   escalate  root`);
    window.addEventListener('oni:virus', v);
    return () => window.removeEventListener('oni:virus', v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = (raw: string) => {
    const [c, ...args] = raw.trim().split(/\s+/);
    const arg = args.join(' ');
    const find = (n: string) => items.find((i) => i.name === n);
    push(`${user}@oni:~$ ${raw}`);
    if (!c) return;
    switch (c) {
      case 'help':
        return push('commands: ls  cat <file>  whoami  date  clear  exit');
      case 'ls':
        return push(items.map((i) => (i.kind === 'folder' ? i.name + '/' : i.name)).join('  '));
      case 'cat': {
        const f = find(arg);
        if (!arg) return push('cat: missing file operand');
        if (!f) return push(`cat: ${arg}: no such file`);
        if (f.kind === 'folder') return push(`cat: ${arg}: is a directory`);
        if (f.kind === 'app') return push(`cat: ${arg}: binary file`);
        return push(...f.body.split('\n'));
      }
      case 'whoami':
        return push(user);
      case 'date': {
        const d = new Date();
        d.setFullYear(1997);
        return push(d.toUTCString().replace(' GMT', ''));
      }
      case 'clear':
        return setLines([]);
      case 'exit':
      case 'logout':
        return push('logout: there is no way out');
      case 'sudo':
        return push(`${user} is not in the sudoers file. this incident will be reported.`);
      case 'rm':
        return push('rm: permission denied');
      case 'kill':
        return push(`kill: (${arg || 7}) - operation not permitted`);
      default:
        return push(`${c}: command not found`);
    }
  };

  return (
    <div className="pc-term" ref={body} onClick={() => input.current?.focus({ preventScroll: true })}>
      {lines.map((l, i) => (
        <p key={i} data-hot={l.startsWith('$ ') || l.startsWith(user + '@') || undefined}>
          {l}
        </p>
      ))}
      {tailing ? (
        <p data-hot>
          {typing}
          <i className="pc-caret" />
        </p>
      ) : (
        <p data-hot>
          {user}@oni:~$ {cmd}
          {active && <i className="pc-caret" />}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          audio.key();
          run(cmd);
          setCmd('');
        }}
      >
        <input
          ref={input}
          value={cmd}
          aria-label="terminal"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onKeyDown={(e) => {
            if (!tailing) return;
            // cualquier tecla corta el log, como un ^C
            setTailing(false);
            setTyping('');
            push('^C');
            if (e.key.length !== 1) e.preventDefault();
          }}
          onChange={(e) => {
            audio.key();
            setCmd(e.target.value.slice(0, 80));
          }}
        />
      </form>
    </div>
  );
}
