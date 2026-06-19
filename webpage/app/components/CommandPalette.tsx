'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { FaTimes, FaArrowUp, FaArrowDown } from 'react-icons/fa';

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
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
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
  }, [open]);

  // Auto-focus on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

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

      {/* Palette container */}
      <div className={`pal ${open ? 'pal-open' : ''}`}>
        <div className="palbar">
          <span className="text-gray-400 text-sm">
            <span className="text-primary-purple">⌘</span>K
          </span>
          <input
            ref={inputRef}
            onKeyDown={handleKeyDown}
            className="palq"
            placeholder="Navigate sections..."
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-400 transition-colors"
          >
            <FaTimes className="text-xs" />
          </button>
        </div>

        <div className="palbody">
          {/* ASCII Art Panel */}
          <div className="palart">
            <pre className="text-xs leading-tight overflow-hidden">
              {asciiArt || 'No art loaded'}
            </pre>
          </div>

          {/* Sections List */}
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
        </div>

        {/* Footer hints */}
        <div className="palfoot">
          <span className="flex items-center gap-1">
            <FaArrowUp className="text-[10px]" />
            <FaArrowDown className="text-[10px]" />
            <span>navigate</span>
          </span>
          <span>↵ go</span>
          <span>esc close</span>
        </div>
      </div>
    </>
  );
}
