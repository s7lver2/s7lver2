'use client';

import { useRef, useEffect } from 'react';

export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let observer: IntersectionObserver | null = null;

    const attach = (node: T) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        node.classList.add('revealed');
        return;
      }
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer?.unobserve(entry.target);
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(node);
    };

    // Some callers (HTB, GitHub) mount the ref'd element only after an async
    // fetch resolves, so it may not exist on this effect's first run. Poll a
    // few frames instead of assuming ref.current is already there — without
    // this, the observer is never created and the element stays permanently
    // opacity:0 (invisible), since this effect never runs a second time.
    const tryAttach = () => {
      if (disposed) return;
      if (ref.current) {
        attach(ref.current);
        return;
      }
      raf = requestAnimationFrame(tryAttach);
    };
    tryAttach();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      if (observer && ref.current) observer.unobserve(ref.current);
    };
  }, []);

  return ref;
}
