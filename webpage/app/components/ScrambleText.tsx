'use client';
import { useEffect, useRef, useState } from 'react';

const CHARS = '!<>-_\\/[]{}=+*^?#@01';

export default function ScrambleText({ text }: { text: string }) {
  const [output, setOutput] = useState(text);
  const ref = useRef<HTMLSpanElement>(null);
  const ran = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !ran.current) {
          ran.current = true;
          scramble();
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  function scramble() {
    const queue = text.split('').map((char) => ({
      char,
      start: Math.floor(Math.random() * 16),
      end: 16 + Math.floor(Math.random() * 24),
      current: '',
    }));
    let frame = 0;

    const tick = () => {
      let out = '';
      let done = 0;
      for (const q of queue) {
        if (frame >= q.end) {
          out += q.char;
          done++;
        } else if (frame >= q.start) {
          q.current = CHARS[Math.floor(Math.random() * CHARS.length)];
          out += `\x00${q.current}\x01`;
        } else {
          out += q.char;
        }
      }
      setOutput(out);
      frame++;
      if (done < queue.length) requestAnimationFrame(tick);
      else setOutput(text);
    };
    requestAnimationFrame(tick);
  }

  // Render with scramble chars highlighted in accent colour
  const parts = output.split(/\x00(.*?)\x01/);
  return (
    <span ref={ref}>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <span key={i} style={{ color: 'var(--brand-1)', opacity: 0.75 }}>{part}</span>
          : part
      )}
    </span>
  );
}
