'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { FaTimes, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import TerminalPanel from './TerminalPanel';

// Image manifest - add your images to /public/art/
const ART_IMAGES: string[] = [
  '/art/1.png',
  '/art/2.png',
  '/art/3.png',
];

// Navigation sections
const SECTIONS = [
  { label: 'Home', href: '#about', id: 'hero' },
  { label: 'Skills', href: '#skills', id: 'skills' },
  { label: 'Projects', href: '#projects', id: 'projects' },
  { label: 'HackTheBox', href: '#htb', id: 'htb' },
  { label: 'GitHub', href: '#github', id: 'github' },
  { label: 'Contact', href: '#contact', id: 'contact' },
];

// Canvas to ASCII conversion utility
async function loadImageToCanvas(imagePath: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 30;
      canvas.height = 15;
      const ctx = canvas.getContext('2d');
      if (!ctx) reject(new Error('Failed to get canvas context'));
      else {
        ctx.drawImage(img, 0, 0, 30, 15);
        resolve(canvas);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${imagePath}`));
    img.src = imagePath;
  });
}

// Convert canvas to ASCII art
function toAscii(canvas: HTMLCanvasElement, width: number, height: number): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const chars = '@%#*+=-:. ';
  let ascii = '';

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const pixelIndex = (i * width + j) * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      const brightness = (r + g + b) / 3 / 255;
      const charIndex = Math.floor(brightness * (chars.length - 1));
      ascii += chars[charIndex];
    }
    ascii += '\n';
  }

  return ascii;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'nav' | 'term';
  onNavigate?: (s: string) => void;
}

export default function CommandPalette({
  open,
  onClose,
  initialTab = 'nav',
  onNavigate
}: CommandPaletteProps) {
  const [tab, setTab] = useState<'nav' | 'term'>('nav');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [asciiArt, setAsciiArt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Load random ASCII art on palette open
  useEffect(() => {
    if (open && ART_IMAGES.length > 0) {
      const randomImage = ART_IMAGES[Math.floor(Math.random() * ART_IMAGES.length)];
      loadImageToCanvas(randomImage)
        .then((canvas) => {
          const ascii = toAscii(canvas, 30, 15);
          setAsciiArt(ascii);
        })
        .catch((err) => console.error('ASCII art error:', err));
    }
    setSelectedIdx(0);
    setTab(initialTab);
  }, [open, initialTab]);

  // Auto-focus on open
  useEffect(() => {
    if (open && tab === 'nav') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, tab]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, SECTIONS.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const section = SECTIONS[selectedIdx];
        if (section) {
          const element = document.getElementById(section.id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            onClose();
          }
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [selectedIdx, onClose]
  );

  // Auto-scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedIdx]);

  return (
    <>
      {/* Overlay backdrop */}
      {open && (
        <div
          className="ov"
          onClick={onClose}
        />
      )}

      {/* Command Center container */}
      <div className={`cc ${open ? 'cc-open' : ''}`}>
        {/* Mac-style window header with dots */}
        <div className="ccbar">
          <div className="dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="cctitle">command center</div>
          <button
            onClick={onClose}
            className="ccx"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        {/* Tab buttons */}
        <div className="cctabs">
          <button
            className={`cctab ${tab === 'nav' ? 'cctab-active' : ''}`}
            onClick={() => setTab('nav')}
          >
            ❯ navigate
          </button>
          <button
            className={`cctab ${tab === 'term' ? 'cctab-active' : ''}`}
            onClick={() => setTab('term')}
          >
            $ terminal
          </button>
        </div>

        {/* Tab content */}
        <div className="ccbody">
          {/* Navigate panel */}
          {tab === 'nav' && (
            <>
              <div className="ccq-wrapper">
                <input
                  ref={inputRef}
                  onKeyDown={handleKeyDown}
                  className="ccq"
                  placeholder="Navigate sections..."
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="palart">
                <pre className="text-xs leading-tight overflow-hidden">
                  {asciiArt || 'No art loaded'}
                </pre>
              </div>

              <div className="pallist">
                {SECTIONS.map((section, idx) => (
                  <button
                    ref={idx === selectedIdx ? selectedRef : null}
                    key={section.id}
                    onClick={() => {
                      const element = document.getElementById(section.id);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                        onClose();
                      }
                    }}
                    className={`li ${idx === selectedIdx ? 'li-selected' : ''}`}
                  >
                    <span className="li-label">{section.label}</span>
                    <span className="li-hint">{section.href}</span>
                  </button>
                ))}
              </div>

              <div className="palfoot">
                <span className="flex items-center gap-1">
                  <FaArrowUp className="text-[10px]" />
                  <FaArrowDown className="text-[10px]" />
                  <span>navigate</span>
                </span>
                <span>↵ go</span>
                <span>esc close</span>
              </div>
            </>
          )}

          {/* Terminal panel stub */}
          {tab === 'term' && (
            <TerminalPanel
              active={open && tab === 'term'}
              onClose={onClose}
              onNavigate={onNavigate}
              onBackToNav={() => setTab('nav')}
            />
          )}
        </div>
      </div>
    </>
  );
}
