'use client';
import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Hero from './Hero';
import Toast from './Toast';
import { scroll } from './scroll';

export default function OniHome({ fontFamily }: { fontFamily: string }) {
  // sin menú contextual: rompe la ilusión del ordenador (y de toda la escena)
  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', block);
    return () => window.removeEventListener('contextmenu', block);
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ lerp: 0.085 });
    scroll.lenis = lenis;
    if (document.documentElement.dataset.loading) lenis.stop();
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      scroll.lenis = null;
    };
  }, []);

  return (
    <main className="oni">
      <Hero fontFamily={fontFamily} />
      <Toast />
    </main>
  );
}
