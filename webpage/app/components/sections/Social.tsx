'use client';

import { useEffect, useState, useRef } from 'react';
import { toAscii, loadImageToCanvas, generateAvatarCanvas } from '@/lib/ascii';
import { useReveal } from '@/lib/reveal';
import ScrambleText from '@/components/ScrambleText';
import { DEFAULT_SOCIALS } from '@/lib/content-constants';

const PLACEHOLDER_ASCII = `
        :=+*#%@#*+=:
       =%*#@@@@@#*%=
      =#*@######@*#=
     +#*@##%:::%##*#+
    =%*#@###:::###*#%=
    *#@#####::::####@#*
    @@#####%::%#####@@
    *#@#####::::####@#*
    =%*#@###:::###*#%=
     +#*@##%:::%##*#+
      =#*@######@*#=
       =%*#@@@@@#*%=
        :=+*#%@#*+=:
        :..:..:..:.:
`.trim();

interface Social {
  k: string;
  v: string;
  color: string;
  avatar?: string;
  url: string;
  ascii?: string;
  initials?: string;
}

export default function SocialSection() {
  const reveal = useReveal();
  const defaultSocials = DEFAULT_SOCIALS.map((s) => ({
    k: s.k,
    v: s.v,
    color: s.color,
    url: s.url,
    initials: s.initials,
    avatar: `/api/avatar/${s.k}`,
  }));
  const [socials, setSocials] = useState<Social[]>(defaultSocials);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch socials from KV with fallback to defaults
  useEffect(() => {
    fetch('/api/content/socials')
      .then((r) => r.ok ? r.json() : null)
      .then((d: Social[] | null) => {
        if (Array.isArray(d) && d.length) {
          setSocials(d.map((s) => ({
            ...s,
            avatar: s.avatar || `/api/avatar/${s.k}`,
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Cargar ASCIIs de avatares
  useEffect(() => {
    const loadAvatars = async () => {
      const updated = await Promise.all(
        socials.map(async (social) => {
          try {
            // Intenta cargar la imagen real
            if (social.avatar) {
              const canvas = await loadImageToCanvas(social.avatar, 160, 160);
              return {
                ...social,
                ascii: toAscii(canvas, 64, 36),
              };
            }
            throw new Error('No avatar');
          } catch (e) {
            try {
              // Si falla, genera un canvas con gradiente + iniciales
              const canvas = generateAvatarCanvas(social.color, social.initials || '?', 160, 160);
              return {
                ...social,
                ascii: toAscii(canvas, 64, 36),
              };
            } catch (e2) {
              // Si todo falla, usa placeholder
              return {
                ...social,
                ascii: PLACEHOLDER_ASCII,
              };
            }
          }
        })
      );
      setSocials(updated);
      setLoading(false);
    };

    loadAvatars();
  }, [socials.length]);

  // Navegación por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Si está escribiendo, no hace nada
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Solo responder si algún elemento está enfocado en la página
      // o si el evento proviene de "fuera" de un input (neutral)

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % socials.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + socials.length) % socials.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelect(selectedIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, socials.length]);

  const handleSelect = (index: number) => {
    const social = socials[index];
    setFeedback(`→ opening ${social.v} …`);
    setTimeout(() => {
      if (social.url.startsWith('http')) {
        window.open(social.url, '_blank', 'noopener,noreferrer');
      }
      setFeedback('');
    }, 600);
  };

  const currentSocial = socials[selectedIndex];

  return (
    <section id="contact" className="section py-24 px-4">
      <div className="container-page">
        <div ref={reveal} className="reveal">
          <span className="seclabel">Sección · Social</span>
          <div className="eyebrow">./connect.sh</div>
          <h2 className="h2"><ScrambleText text="Find me online" /></h2>
          <p className="secdesc">
            Pasa por cada red: el ASCII de la izquierda muestra tu{' '}
            <b>foto de perfil</b> (generada dinámicamente desde canvas).
          </p>

          <div className="ff">
            <div className="ffbar">
              <i className="r"></i>
              <i className="y"></i>
              <i className="g"></i>
              <span className="t">s7lver@social: ~/networks</span>
            </div>

            <div className="ffbody">
              <pre
                className="art"
                style={{
                  color: currentSocial?.color || '#fff',
                }}
              >
                {loading ? 'Loading avatars...' : currentSocial?.ascii || ''}
              </pre>

              <div className="list">
                <div className="li-container" ref={listRef}>
                  {socials.map((social, index) => (
                    <div
                      key={social.k}
                      className={`social-li ${index === selectedIndex ? 'sel' : ''}`}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => handleSelect(index)}
                    >
                      <span className="pk">❯</span>
                      <span className="k" style={{ color: social.color }}>
                        {social.k}
                      </span>
                      <span className="v">{social.v}</span>
                    </div>
                  ))}
                </div>
                <div className="fb" id="sFb">
                  {feedback}
                </div>
              </div>
            </div>
          </div>

          <p className="hint">
            <b>↑</b>
            <b>↓</b> navegar · <b>↵</b> abrir · o hover/click
          </p>
        </div>
      </div>
    </section>
  );
}
