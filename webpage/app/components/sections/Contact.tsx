'use client';
import {
  FaGithub, FaDiscord, FaTwitter, FaTiktok, FaInstagram, FaEnvelope,
} from 'react-icons/fa';

const socials = [
  { icon: <FaGithub />,    name: 'GitHub',    handle: '@s7lver2',     link: 'https://github.com/s7lver2' },
  { icon: <FaDiscord />,   name: 'Discord',   handle: 's7lver2',      link: '#' },
  { icon: <FaTwitter />,   name: 'X',         handle: '@not_s7lver',  link: 'https://twitter.com/not_s7lver' },
  { icon: <FaTiktok />,    name: 'TikTok',    handle: '@s7lver6',     link: 'https://tiktok.com/@s7lver6' },
  { icon: <FaInstagram />, name: 'Instagram', handle: 'ims7lver',     link: 'https://instagram.com/ims7lver' },
];

export { socials };

export default function ContactSection() {
  return (
    <section id="contact" className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Meet me</h2>
          <p className="text-gray-500">Find me!</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          {socials.map((social, index) => (
            <a
              key={social.name}
              href={social.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`${index === 0 ? 'card-glass' : 'card-subtle'} p-5 hover:border-white/20 transition-all duration-300 group`}
            >
              <div className="flex items-center gap-4">
                <div className="text-2xl text-gray-500 group-hover:text-white transition-colors">
                  {social.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white mb-0.5">{social.name}</h3>
                  <p className="text-xs text-gray-500">{social.handle}</p>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="card-accent p-8 backdrop-blur-xl max-w-2xl mx-auto text-center">
          <blockquote className="text-xl md:text-2xl text-gray-300 italic mb-6">
            "Are you interested in a more serious talk? Email me"
          </blockquote>
          <div className="flex items-center justify-center gap-3 text-gray-400">
            <FaEnvelope className="text-lg" />
            <a href="mailto:nickespro130@outlook.es" className="hover:text-white transition-colors">
              nickespro130@outlook.es
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}