'use client';
import { FaSkull, FaFlag, FaNetworkWired } from 'react-icons/fa';

const cybersecSkills = [
  {
    category: 'Pentesting / Red Team',
    icon: <FaSkull />,
    colorClass: 'text-red-400',
    accentColor: 'rgb(248 113 113)',
    glowClass:   'hover:shadow-red-500/10',
    skills: ['Burp Suite', 'SQLMap', 'Hydra', 'Hashcat', 'Mimikatz', 'Impacket', 'Wfuzz', 'CrackMapExec', 'Evil-WinRM'],
  },
  {
    category: 'CTF & Exploitation',
    icon: <FaFlag />,
    colorClass: 'text-yellow-400',
    accentColor: 'rgb(250 204 21)',
    glowClass:   'hover:shadow-yellow-500/10',
    skills: ['Buffer Overflow', 'Rev Engineering', 'Web Exploitation', 'Cryptography', 'Steganography', 'OSINT', 'Ghidra', 'Pivoting', 'Active Directory', 'Path Traversals', 'pwntools'],
  },
  {
    category: 'Networking & Recon',
    icon: <FaNetworkWired />,
    colorClass: 'text-cyan-400',
    accentColor: 'rgb(34 211 238)',
    glowClass:   'hover:shadow-cyan-500/10',
    skills: ['Nmap', 'Wireshark', 'Netcat', 'Gobuster', 'Subfinder', 'Amass', 'tcpdump', 'Masscan', 'Responder', 'Enum4linux'],
  },
];

export default function SkillsSection() {
  return (
    <section id="skills" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 rounded-full border border-green-500/20 bg-green-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-mono text-green-400 tracking-widest uppercase">
              sys: cybersec.skills loaded
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Security Skills</h2>
          <p className="text-gray-500 font-mono text-sm">// tools &amp; techniques I wield</p>
        </div>

        {/* Cards */}
        <div className="grid lg:grid-cols-3 gap-6">
          {cybersecSkills.map((cat) => (
            <div
              key={cat.category}
              className={`relative rounded-xl border border-white/10 bg-white/[0.02] p-6 transition-all duration-300 group shadow-lg ${cat.glowClass} hover:bg-white/[0.04] hover:border-white/20`}
            >
              {/* Accent left border */}
              <div
                className="absolute left-0 top-6 bottom-6 w-0.5 rounded-full opacity-50 group-hover:opacity-90 transition-opacity"
                style={{ background: cat.accentColor }}
              />

              {/* Category header */}
              <div className="flex items-center gap-3 mb-5 pl-3">
                <span className={`text-xl ${cat.colorClass}`}>{cat.icon}</span>
                <h3 className={`text-xs font-mono font-semibold ${cat.colorClass} tracking-widest uppercase`}>
                  {cat.category}
                </h3>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 pl-3">
                {cat.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 text-xs font-mono rounded-md bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors cursor-default"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}