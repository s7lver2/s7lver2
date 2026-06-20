/**
 * Terminal Command Engine
 * Shared module for processing terminal commands and managing state
 */

// ── ASCII Banner ───────────────────────────────────────────────────────
export const BANNER = `
  ███  ██████  ██      ██  ██  ██████  █████
 ████      ██  ██      ██  ██  ██      ██  ██
███       ██   ██      ██  ██  ████   █████
 ███     ██    ██       ████   ██      ██ ██
  ███   ██     ██  ██    ██    ██      ██  ██
████    ██     ██████    ██    ██████  ██  ██

s7lver@portfolio ~ zsh · type 'help'
`;

// ── Themes: [text-color, bg-accent-color] ─────────────────────────────
export const THEMES: Record<string, [string, string]> = {
  morado: ['#c77dff', '#7209b7'],
  azul: ['#00d9ff', '#0096c7'],
  verde: ['#00ff00', '#008000'],
  mono: ['#ffffff', '#666666'],
};

// ── Command List ──────────────────────────────────────────────────────
export const COMMANDS = [
  'whoami', 'ls', 'cat', 'nmap', 'ping', 'skills', 'sudo', 'hack', 'uname',
  'history', 'github', 'htb', 'open', 'help', 'clear', 'exit',
  // New commands:
  'neofetch', 'banner', 'date', 'uptime', 'echo', 'curl', 'exploit', 'ssh',
  'matrix', 'theme',
];

// ── Command Processor ──────────────────────────────────────────────────
export function processCommand(raw: string, onNavigate?: (section: string) => void): string {
  const input = raw.trim();
  const lower = input.toLowerCase();
  const [cmd, ...args] = lower.split(' ');

  switch (cmd) {
    // ─── Original Commands ─────────────────────────────────────────────

    case 'help':
      return `
Available commands:
  whoami          → Operator profile
  ls [-la]        → List sections
  cat <file>      → Read a file
  nmap localhost  → Scan this host
  ping <host>     → Ping a host
  skills          → Cybersecurity skills
  sudo <cmd>      → Try your luck
  hack            → Initialize hack sequence
  uname -a        → System info
  history         → Command history
  github          → GitHub summary
  htb             → HackTheBox stats
  open <section>  → Navigate to section
  banner          → Print ASCII banner
  neofetch        → System fetch
  date            → Show date/time
  uptime          → Show uptime
  echo <text>     → Echo text
  curl <section>  → Navigate (alias for open)
  theme <name>    → Change theme (morado/azul/verde/mono)
  exploit         → Try an exploit
  ssh             → SSH connection
  matrix          → Matrix rain effect
  clear           → Clear terminal
  exit            → Close terminal
      `;

    case 'whoami':
      return `s7lver
uid=1337(s7lver) gid=1337(hackers) groups=1337(hackers),0(root)
Role:   Developer & Cybersecurity Student
Focus:  Pentesting · CTF · Red Team
HTB:    Hacker Rank | user s7lver
`;

    case 'ls':
      return args[0] === '-la' || args[0] === '-l'
        ? `total 5
drwxr-xr-x  s7lver  s7lver  about/
drwxr-xr-x  s7lver  s7lver  skills/
drwxr-xr-x  s7lver  s7lver  projects/
drwxr-xr-x  s7lver  s7lver  htb/
drwxr-xr-x  s7lver  s7lver  contact/`
        : 'about/  skills/  projects/  htb/  contact/';

    case 'cat':
      if (!args[0]) return 'cat: missing file operand. Try: cat flag.txt, cat about.txt';
      if (args[0] === 'flag.txt') return `
Congrats. You found it.

HTB{y0u_f0und_th3_s3cr3t_t3rm1n4l_3gg}

Keep hacking. 🚩`;
      if (args[0] === 'about.txt') return `Name:     s7lver
Role:     Developer & Cybersec Student
Stack:    Go · Rust · TypeScript · Python
Projects: ZephyrOS · tsuki · file-meet · CodeDotJS
Contact:  nickespro130@outlook.es`;
      if (args[0] === '/etc/passwd') return `root:x:0:0:root:/root:/bin/bash
s7lver:x:1337:1337::/home/s7lver:/bin/zsh
visitor:x:9999:9999::/dev/null:/bin/false`;
      if (args[0] === '/etc/shadow') return 'Permission denied: you wish 😂';
      return `cat: ${args[0]}: No such file or directory`;

    case 'nmap':
      return `Starting Nmap 7.94 ( https://nmap.org )
Nmap scan report for s7lver.dev
Host is up (0.0001s latency).

PORT     STATE  SERVICE  VERSION
22/tcp   open   ssh      OpenSSH 9.0
80/tcp   open   http     Next.js 15
443/tcp  open   https    Next.js 15
3000/tcp closed dev-mode

OS: Portfolio Linux 6.6-s7lver
Scanned in 2.13 seconds`;

    case 'ping':
      const host = args[0] || 'localhost';
      return `PING ${host}: 56 bytes
64 bytes: icmp_seq=0 ttl=63 time=42.0 ms
64 bytes: icmp_seq=1 ttl=63 time=41.8 ms
64 bytes: icmp_seq=2 ttl=63 time=42.3 ms
3 packets transmitted, 3 received, 0% packet loss`;

    case 'skills':
      return `[RED TEAM]  Metasploit · Burp Suite · SQLMap · Hydra · Mimikatz
[CTF]       Buffer Overflow · Rev Eng · Web Exploitation · Ghidra
[RECON]     Nmap · Wireshark · Gobuster · Subfinder · Responder`;

    case 'sudo':
      // Special case: "sudo make me a sandwich"
      if (args.join(' ') === 'make me a sandwich') {
        return 'Okay. 🥪';
      }
      // Special case: "sudo su"
      if (args.join(' ') === 'su') {
        return 'root access denied. nice try, visitor 😏';
      }
      if (args.join(' ') === 'rm -rf /' || args.join(' ') === 'rm -rf /*')
        return '[ NICE TRY ] Portfolio is read-only 😏';
      return `[sudo] password for visitor:
Sorry, try again.
[sudo] password for visitor:
sudo: 3 incorrect password attempts`;

    case 'hack':
      return `Initializing hack sequence...
[████████████████████] 100%

ERROR: Target is s7lver himself.
Recursion detected. Cannot hack the hacker. Aborting.`;

    case 'uname':
      return `Linux portfolio 6.6.0-s7lver #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux
Built with Next.js 15 & pure chaos`;

    case 'history':
      return `    1  whoami
    2  ls -la
    3  cat flag.txt
    4  sudo rm -rf /
    5  nmap localhost
    6  hack`;

    case 'github':
      return `Fetching GitHub summary…
See GitHub section or: open github`;

    case 'htb':
      return `HackTheBox stats in #htb section. Try: open htb`;

    case 'open':
      const section = args[0];
      const validSections = ['hero', 'skills', 'projects', 'htb', 'github', 'contact'];
      if (!section) {
        return `Usage: open <section>\nValid sections: ${validSections.join(', ')}`;
      }
      if (!validSections.includes(section)) {
        return `Invalid section: ${section}\nValid sections: ${validSections.join(', ')}`;
      }
      // Signal to close and navigate
      if (onNavigate) onNavigate(section);
      return '__NAVIGATE__';

    // ─── New Commands ──────────────────────────────────────────────────

    case 'neofetch':
      // Simulated neofetch output
      return `         _._._
        (o o)
       ( =^= )
        /|   |\\
       / |   | \\

  s7lver@portfolio
  ─────────────────────
  OS:     Portfolio Linux 6.6-s7lver
  Kernel: 6.6.0-s7lver (x86_64)
  Shell:  zsh
  Memory: 1337 / 8192 MB
  CPU:    Intel Core i7-Hacker
  Uptime: 420 days, 13 hours
  Theme:  Cyberpunk Dark
  Font:   JetBrains Mono

__NEOFETCH__`;

    case 'banner':
      return BANNER;

    case 'date':
      const now = new Date();
      return `${now.toString()}`;

    case 'uptime':
      // Simulated uptime
      return ` 12:34:56 up 420 days, 13:37 min, 1 user, load average: 0.42, 0.13, 0.37`;

    case 'echo':
      // Echo the rest of the command
      const text = args.join(' ');
      return text || '';

    case 'curl':
      // curl acts like 'open' for navigation
      const curlSection = args[0];
      const validCurlSections = ['hero', 'skills', 'projects', 'htb', 'github', 'contact'];
      if (!curlSection) {
        return `Usage: curl <section>\nValid sections: ${validCurlSections.join(', ')}`;
      }
      if (!validCurlSections.includes(curlSection)) {
        return `Invalid section: ${curlSection}\nValid sections: ${validCurlSections.join(', ')}`;
      }
      if (onNavigate) onNavigate(curlSection);
      return '__NAVIGATE__';

    case 'exploit':
      return `[*] Initializing exploit...
[▓▓▓░░░░░░░░░░░░░░░░] 15%
[▓▓▓▓▓▓▓░░░░░░░░░░░░] 35%
[▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░] 55%
[▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░] 90%
[▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓] 100%

Exploit compiled successfully.
But you already lost the game 🎮`;

    case 'ssh':
      // Check for specific target
      const target = args.join('@');
      if (target === 's7lver@box') {
        return `Connecting to s7lver@box...
[▓▓▓▓▓▓▓▓▓░░░░░░░░░░] 50%
[▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░] 85%
[▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓] 100%

Connection established.
Welcome to the portfolio matrix. 🔓`;
      }
      return `Usage: ssh s7lver@box
ssh: Connect to remote host failed`;

    case 'matrix':
      // Matrix rain effect sentinel
      return '__MATRIX__';

    case 'theme':
      const themeName = args[0];
      if (!themeName) {
        return `Usage: theme <name>\nAvailable themes: ${Object.keys(THEMES).join(', ')}`;
      }
      if (!THEMES[themeName]) {
        return `Theme not found: ${themeName}\nAvailable themes: ${Object.keys(THEMES).join(', ')}`;
      }
      // Return sentinel for Task 7 to apply theme
      return `__THEME__:${themeName}`;

    case 'clear':
      return '__CLEAR__';

    case 'exit':
      return '__EXIT__';

    case '':
      return '';

    default:
      return `bash: ${cmd}: command not found\nType 'help' for available commands.`;
  }
}
