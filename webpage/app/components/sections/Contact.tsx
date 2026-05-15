// app/components/sections/Contact.tsx
'use client';
import {
  FaGithub, FaDiscord, FaTwitter, FaTiktok, FaInstagram,
} from 'react-icons/fa';
import MeetPlanet from '../planets/MeetPlanet';

const socialLinks = [
  { name: 'GitHub', handle: '@s7lver2', url: 'https://github.com/s7lver2', icon: <FaGithub />, color: '#e5e7eb' },
  { name: 'Discord', handle: 's7lver2', url: '#', icon: <FaDiscord />, color: '#818cf8' },
  { name: 'X (Twitter)', handle: '@not_s7lver', url: 'https://twitter.com/not_s7lver', icon: <FaTwitter />, color: '#60a5fa' },
  { name: 'TikTok', handle: '@s7lver6', url: 'https://tiktok.com/@s7lver6', icon: <FaTiktok />, color: '#f9a8d4' },
  { name: 'Instagram', handle: 'ims7lver', url: 'https://instagram.com/ims7lver', icon: <FaInstagram />, color: '#f97316' },
];

export default function ContactSection() {
  return (
    <section id="contact" className="section-planet overflow-hidden">
      <div className="w-full max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center gap-0">
        {/* Columna izquierda: lista de redes sociales */}
        <div className="flex-1 flex flex-col gap-4 pr-8">
          <div className="mb-6">
            <p className="text-xs font-mono text-pink-400 tracking-widest uppercase mb-2">// meet me at</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white">Contact</h2>
          </div>
          {socialLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target={link.url !== '#' ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="group flex items-center gap-4 px-5 py-4 rounded-xl border border-white/10 bg-white/[0.02] hover:border-pink-500/30 hover:bg-pink-500/5 transition-all duration-200"
            >
              <span className="text-2xl text-gray-400 group-hover:text-pink-400 transition-colors">
                {link.icon}
              </span>
              <div className="flex-1">
                <p className="text-white font-medium">{link.name}</p>
                <p className="text-xs text-gray-500 font-mono group-hover:text-gray-400 transition-colors">
                  {link.handle}
                </p>
              </div>
              <span className="text-gray-600 group-hover:text-pink-400 transition-colors">→</span>
            </a>
          ))}
        </div>

        {/* Columna derecha: planeta rosa (sobresale por la derecha) */}
        <div className="flex justify-end md:justify-center flex-shrink-0 md:-mr-16 lg:-mr-24">
          <div style={{ width: 400, height: 400 }}>
            <MeetPlanet />
          </div>
        </div>
      </div>
    </section>
  );
}