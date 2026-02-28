'use client';
import { FaExternalLinkAlt } from 'react-icons/fa';

const projects = [
  {
    title:       'file-meet',
    description: 'CLI tool written in Go for easier file transfers between systems. Allows users to safely send and receive files.',
    tech:        ['Go', 'CLI', 'Networking'],
    link:        'https://github.com/s7lver2/file-meet',
    status:      'Done',
  },
  {
    title:       'ZephyrOS',
    description: 'Arch based Operative system, designed for old computers and servers with a custom kernel.',
    tech:        ['Linux', 'Arch', 'QML', 'Shell'],
    link:        'https://github.com/s7lver2/ZephyrOS',
    status:      'Stable but with updates on way',
  },
  {
    title:       'CodeDotJS',
    description: 'Revolutionary framework for Code.org that extends their capabilities with javascript for strong developments.',
    tech:        ['JavaScript', 'Framework'],
    link:        'https://CodeDotjs.vercel.app',
    status:      'Beta',
  },
  {
    title:       'tsuki',
    description: 'Code transpiler for build projects for arduino. Custom implementations, IDE, cli, more than 5 languages and native library compatibility.',
    tech:        ['Rust', 'Go', 'Ruby', 'Python'],
    link:        'https://github.com/s7lver2/tsuki',
    status:      'In Development',
  },
];

export { projects };

export default function ProjectsSection() {
  return (
    <section id="projects" className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">My projects</h2>
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
                <FaExternalLinkAlt className="text-gray-600 group-hover:text-white transition-colors text-sm shrink-0 mt-1" />
              </div>

              <p className="text-gray-500 text-sm mb-4 leading-relaxed">{project.description}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                {project.tech.map((t) => (
                  <span key={t} className="px-2.5 py-1 text-xs rounded-md bg-white/5 border border-white/10 text-gray-400">
                    {t}
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
  );
}