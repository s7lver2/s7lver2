'use client';
import { FaGithub, FaDiscord, FaTwitter, FaTiktok, FaInstagram } from 'react-icons/fa';

const socials = [
  { icon: <FaGithub />,    name: 'GitHub',    link: 'https://github.com/s7lver2' },
  { icon: <FaDiscord />,   name: 'Discord',   link: '#' },
  { icon: <FaTwitter />,   name: 'X',         link: 'https://twitter.com/not_s7lver' },
  { icon: <FaTiktok />,    name: 'TikTok',    link: 'https://tiktok.com/@s7lver6' },
  { icon: <FaInstagram />, name: 'Instagram', link: 'https://instagram.com/ims7lver' },
];

const projects = [
  { title: 'file-meet', link: 'https://github.com/s7lver2/file-meet' },
  { title: 'ZephyrOS',  link: 'https://github.com/s7lver2/ZephyrOS' },
  { title: 'CodeDotJS', link: 'https://CodeDotjs.vercel.app' },
  { title: 'tsuki',     link: 'https://github.com/s7lver2/tsuki' },
];

const navLinks = [
  { id: 'about',    label: 'Introduction' },
  { id: 'skills',   label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'htb',      label: 'HTB' },
  { id: 'contact',  label: 'Contact' },
];

export default function Footer() {
  const scroll = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <footer className="relative z-10 border-t border-white/10 bg-black/50 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="text-xl font-bold mb-4">
              <span className="text-white">s7lver</span>
              <span className="text-gradient">2</span>
            </div>
            <p className="text-sm text-gray-500">Developer & cybersecurity student</p>
          </div>

          {/* Nav */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Navigation</h4>
            <ul className="space-y-2">
              {navLinks.map(({ id, label }) => (
                <li key={id}>
                  <button
                    onClick={() => scroll(id)}
                    className="text-sm text-gray-500 hover:text-white transition-colors"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Projects */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Projects</h4>
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.title}>
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-white transition-colors"
                  >
                    {p.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Social</h4>
            <ul className="space-y-2">
              {socials.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-2"
                  >
                    {s.icon}<span>{s.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-600">© 2026 s7lver. All rights reserved</p>
          <p className="text-sm text-gray-600">Built in Next.js · Deployed with Vercel</p>
          {/* Tiny easter egg hint */}
          <p className="text-[11px] text-gray-800 font-mono select-none" aria-hidden>
            // press ` to open terminal
          </p>
        </div>
      </div>
    </footer>
  );
}