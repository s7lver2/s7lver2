'use client';

/**
 * Command palette commands and filtering
 */

export type CommandContext = {
  openTerminal: () => void;
  close: () => void;
};

export type Command = {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  run: (ctx: CommandContext) => void;
};

// ── Helper functions ──────────────────────────────────────────────────────

/**
 * goTo - Navigate to a section and close the command palette
 */
function goTo(sectionId: string, ctx: CommandContext) {
  ctx.close();
  const element = document.getElementById(sectionId);
  element?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * openExternal - Open a URL in a new tab and close the command palette
 */
function openExternal(url: string, ctx: CommandContext) {
  ctx.close();
  window.open(url, '_blank');
}

// ── Command registry ──────────────────────────────────────────────────────

/**
 * buildCommands - Build the complete command list with context
 */
export function buildCommands(ctx: CommandContext): Command[] {
  return [
    {
      id: 'home',
      label: 'Go to Home',
      keywords: 'top hero start',
      run: () => goTo('hero', ctx),
    },
    {
      id: 'skills',
      label: 'Go to Skills',
      keywords: 'cybersec red team',
      run: () => goTo('skills', ctx),
    },
    {
      id: 'projects',
      label: 'Go to Projects',
      keywords: 'work repos',
      run: () => goTo('projects', ctx),
    },
    {
      id: 'htb',
      label: 'Open HackTheBox stats',
      keywords: 'hacking rank',
      run: () => goTo('htb', ctx),
    },
    {
      id: 'github',
      label: 'View GitHub activity',
      keywords: 'code repos stars',
      run: () => goTo('github', ctx),
    },
    {
      id: 'contact',
      label: 'Go to Contact',
      keywords: 'email social',
      run: () => goTo('contact', ctx),
    },
    {
      id: 'terminal',
      label: 'Launch terminal',
      hint: '`',
      keywords: 'shell console',
      run: () => {
        ctx.close();
        ctx.openTerminal();
      },
    },
    {
      id: 'gh-ext',
      label: 'Open GitHub profile',
      keywords: 'external',
      run: () => openExternal('https://github.com', ctx),
    },
  ];
}

/**
 * filterCommands - Filter commands by matching label and keywords against query
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  if (!query.trim()) return commands;

  const q = query.toLowerCase();

  return commands.filter((cmd) => {
    const labelMatch = cmd.label.toLowerCase().includes(q);
    const keywordsMatch = cmd.keywords?.toLowerCase().includes(q);
    return labelMatch || keywordsMatch;
  });
}
