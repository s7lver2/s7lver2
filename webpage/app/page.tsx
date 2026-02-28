'use client';
import { useEffect, useState } from 'react';
import {
  FaGithub, FaDiscord, FaTwitter, FaTiktok, FaInstagram,
  FaEnvelope, FaReact, FaNodeJs, FaPython, FaDocker, FaGitAlt, FaExternalLinkAlt
} from 'react-icons/fa';
import {
  SiTypescript, SiNextdotjs, SiGo, SiLinux, SiRust
} from 'react-icons/si';

// ── Nuevas constantes para las frases ────────────────────────────────
const phrases = [
  "I'm s7lver",
  "Call me s7lver",
  "Code with s7lver",
  "Build with s7lver",
];

const typingSpeed = 80;     // ms por carácter
const deleteSpeed = 50;     // ms por carácter al borrar
const pauseTime   = 1800;   // tiempo que se queda la frase completa

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // ── Estados para el efecto typewriter en el título principal ───────
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Efecto de máquina de escribir + rotación de frases
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const currentFullText = phrases[currentPhraseIndex];

    if (!isDeleting && displayText.length < currentFullText.length) {
      // Escribiendo
      timer = setTimeout(() => {
        setDisplayText(currentFullText.slice(0, displayText.length + 1));
      }, typingSpeed);
    }
    else if (isDeleting && displayText.length > 0) {
      // Borrando
      timer = setTimeout(() => {
        setDisplayText(currentFullText.slice(0, displayText.length - 1));
      }, deleteSpeed);
    }
    else if (!isDeleting && displayText === currentFullText) {
      // Pausa antes de borrar
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, pauseTime);
    }
    else if (isDeleting && displayText === "") {
      // Cambiar a la siguiente frase
      setIsDeleting(false);
      setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
    }

    return () => clearTimeout(timer);
  }, [displayText, isDeleting, currentPhraseIndex]);

  // Actualizar el título de la pestaña (document.title) con typewriter
  useEffect(() => {
    let i = 0;
    let isDeletingTitle = false;
    let currentTitleIndex = 0;
    let titleTimer: NodeJS.Timeout;

    const updateTitle = () => {
      const full = phrases[currentTitleIndex] + " ✦";
      
      if (!isDeletingTitle && i < full.length) {
        document.title = full.slice(0, i + 1);
        i++;
        titleTimer = setTimeout(updateTitle, typingSpeed);
      } else if (isDeletingTitle && i > 0) {
        document.title = full.slice(0, i - 1);
        i--;
        titleTimer = setTimeout(updateTitle, deleteSpeed);
      } else if (!isDeletingTitle && i === full.length) {
        titleTimer = setTimeout(() => {
          isDeletingTitle = true;
          updateTitle();
        }, pauseTime);
      } else if (isDeletingTitle && i === 0) {
        isDeletingTitle = false;
        currentTitleIndex = (currentTitleIndex + 1) % phrases.length;
        updateTitle();
      }
    };

    updateTitle();

    return () => clearTimeout(titleTimer);
  }, []);

  const technologies = [
    { icon: <SiTypescript />, name: 'TypeScript' },
    { icon: <SiNextdotjs />, name: 'Next.js' },
    { icon: <SiRust />, name: 'Rust' },
    { icon: <SiGo />, name: 'Go' },
    { icon: <FaNodeJs />, name: 'Node.js' },
    { icon: <FaPython />, name: 'Python' },
    { icon: <SiLinux />, name: 'Linux' },
    { icon: <FaDocker />, name: 'Docker' },
    { icon: <FaGitAlt />, name: 'Git' },
  ];

  const projects = [
    {
      title: 'file-meet',
      description: 'CLI tool written in Go for easier file transfers between systems. Allows users to safely send and receive files.',
      tech: ['Go', 'CLI', 'Networking'],
      link: 'https://github.com/s7lver2/file-meet',
      status: 'Done'
    },
    {
      title: 'ZephyrOS',
      description: 'Arch based Operative system,designed for old computers and servers with a custom kernel.',
      tech: ['Linux', 'Arch', 'QML', 'Shell'],
      link: 'https://github.com/s7lver2/ZephyrOS',
      status: 'Stable but with updates on way'
    },
    {
      title: 'CodeDotJS',
      description: 'Revolutionary framework for Code.org than extends their capabilities with javascript for strong developments.',
      tech: ['JavaScript',  'Framework'],
      link: 'https://CodeDotjs.vercel.app',
      status: 'Beta'
    },
    {
      title: 'tsuki',
      description: 'Code transpiler for build projects for arduino. Custom implementations, IDE, cli, more than 5 languages and native library compability',
      tech: ['Rust',  'Go', 'Ruby', 'Python'],
      link: 'https://github.com/s7lver2/tsuki',
      status: 'In Development'
    }
  ];

  const socials = [
    { icon: <FaGithub />, name: 'GitHub', handle: '@s7lver2', link: 'https://github.com/s7lver2' },
    { icon: <FaDiscord />, name: 'Discord', handle: 's7lver2', link: '#' },
    { icon: <FaTwitter />, name: 'X', handle: '@not_s7lver', link: 'https://twitter.com/not_s7lver' },
    { icon: <FaTiktok />, name: 'TikTok', handle: '@s7lver6', link: 'https://tiktok.com/@s7lver6' },
    { icon: <FaInstagram />, name: 'Instagram', handle: 'ims7lver', link: 'https://instagram.com/ims7lver' },
  ];

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-black/80 backdrop-blur-lg border-b border-white/10' : 'bg-transparent'
      }`}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold group cursor-pointer">
              <span className="text-white group-hover:text-gradient transition-all duration-300">s</span>
              <span className="text-purple group-hover:text-gradient transition-all duration-300">7</span>
              <span className="text-white group-hover:text-gradient transition-all duration-300">lver</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => scrollToSection('about')} className="text-gray-400 hover:text-white transition-colors text-sm">
                Introduction
              </button>
              <button onClick={() => scrollToSection('projects')} className="text-gray-400 hover:text-white transition-colors text-sm">
                Projects
              </button>
              <button onClick={() => scrollToSection('contact')} className="text-gray-400 hover:text-white transition-colors text-sm">
                Contact
              </button>
              <a 
                href="https://github.com/s7lver2" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FaGithub className="text-xl" />
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="min-h-screen">
        {/* Subtle background gradient */}
        <div className="fixed inset-0 pointer-events-none opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-purple/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-blue/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10">
          {/* Hero Section */}
          <section id="about" className={`min-h-screen flex flex-col items-center justify-center px-6 sm:px-8 pt-20 transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            <div className="w-full max-w-5xl mx-auto text-center space-y-10 md:space-y-14">

              <div className="inline-block px-5 py-2 rounded-full border border-white/10 bg-white/5 mb-6">
                <span className="text-sm sm:text-base text-gray-400 font-medium">Developer & Creator</span>
              </div>

              {/* El título principal con typewriter - CENTRADO y FIJO */}
              <div className="flex justify-center items-center">
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-tight font-mono">
                  <span className="text-gradient inline-block text-center" style={{ minWidth: '18ch' }}>
                    {displayText}<span className="animate-pulse">|</span>
                  </span>
                </h1>
              </div>

              <p className="text-lg sm:text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed px-4">
                Building the future with vibe coding
              </p>

              {/* Tech stack */}
              <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-6 pt-10 md:pt-14 max-w-4xl mx-auto">
                {technologies.map((tech, index) => (
                  <div
                    key={tech.name}
                    className="group flex flex-col items-center gap-2"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="text-3xl sm:text-4xl text-gray-500 group-hover:text-white transition-all duration-300">
                      {tech.icon}
                    </div>
                    <span className="text-xs sm:text-sm text-gray-600 group-hover:text-gray-400 transition-colors">
                      {tech.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-10 sm:bottom-12 animate-bounce">
              <div className="w-6 h-10 border-2 border-white/20 rounded-full flex items-start justify-center p-2">
                <div className="w-1 h-2 bg-white/50 rounded-full animate-pulse"></div>
              </div>
            </div>
          </section>

          {/* Projects Section */}
          <section id="projects" className={`py-24 px-4 transition-opacity duration-1000 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold mb-4 font-[family-name:var(--font-display)]">
                  My projects
                </h2>
                <p className="text-gray-500">Here's My Best Projects</p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project, index) => (
                  <a
                    key={project.title}
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${index === 0 ? 'card-glass' : 'card-subtle'} p-6 hover:border-white/20 transition-all duration-300 group`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-xl font-semibold text-white group-hover:text-gradient transition-all">
                        {project.title}
                      </h3>
                      <FaExternalLinkAlt className="text-gray-600 group-hover:text-white transition-colors text-sm" />
                    </div>

                    <p className="text-gray-500 text-sm mb-4 leading-relaxed">
                      {project.description}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {project.tech.map((tech) => (
                        <span
                          key={tech}
                          className="px-2.5 py-1 text-xs rounded-md bg-white/5 border border-white/10 text-gray-400"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>

                    <div className="text-xs text-gray-600 pt-2 border-t border-white/5">
                      {project.status}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>

          {/* Contact Section */}
          <section id="contact" className={`py-24 px-4 transition-opacity duration-1000 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold mb-4 font-[family-name:var(--font-display)]">
                  Meet me
                </h2>
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
                        <h3 className="text-sm font-semibold text-white mb-0.5">
                          {social.name}
                        </h3>
                        <p className="text-xs text-gray-500">{social.handle}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>

              {/* Contact card */}
              <div className="card-accent p-8 backdrop-blur-xl max-w-2xl mx-auto text-center">
                <blockquote className="text-xl md:text-2xl text-gray-300 italic mb-6">
                  "Are you interested in a more serious talk? Email me"
                </blockquote>
                <div className="flex items-center justify-center gap-3 text-gray-400">
                  <FaEnvelope className="text-lg" />
                  <a
                    href="mailto:nickespro130@outlook.es"
                    className="hover:text-white transition-colors"
                  >
                    nickespro130@outlook.es
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="text-xl font-bold mb-4">
                <span className="text-white">s7lver</span>
                <span className="text-gradient">2</span>
              </div>
              <p className="text-sm text-gray-500">
                Developer & cybersecurity student
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Navegación</h4>
              <ul className="space-y-2">
                <li>
                  <button onClick={() => scrollToSection('about')} className="text-sm text-gray-500 hover:text-white transition-colors">
                    Introduction
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('projects')} className="text-sm text-gray-500 hover:text-white transition-colors">
                    Projects
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('contact')} className="text-sm text-gray-500 hover:text-white transition-colors">
                    Contact
                  </button>
                </li>
              </ul>
            </div>

            {/* Projects */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Projects</h4>
              <ul className="space-y-2">
                {projects.map((project) => (
                  <li key={project.title}>
                    <a 
                      href={project.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-gray-500 hover:text-white transition-colors"
                    >
                      {project.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Social</h4>
              <ul className="space-y-2">
                {socials.map((social) => (
                  <li key={social.name}>
                    <a 
                      href={social.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-2"
                    >
                      {social.icon}
                      <span>{social.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-600">
              © 2026 s7lver. All right reserved
            </p>
            <p className="text-sm text-gray-600">
              Build in Nextjs and deployed with vercel
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}