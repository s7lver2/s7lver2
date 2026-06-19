# Task 5: Commands Registry

**Create:** `app/lib/commands.ts`

Exports:
- Type `CommandContext = { openTerminal: () => void; close: () => void }`
- Type `Command = { id: string; label: string; hint?: string; keywords?: string; run: (ctx) => void }`
- Function `buildCommands(ctx: CommandContext): Command[]` — returns list of commands
- Function `filterCommands(commands: Command[], query: string): Command[]` — filters by label/keywords

Commands (exact):
```ts
{ id: 'home', label: 'Go to Home', keywords: 'top hero start', run: () => goTo('hero', ctx) },
{ id: 'skills', label: 'Go to Skills', keywords: 'cybersec red team', run: () => goTo('skills', ctx) },
{ id: 'projects', label: 'Go to Projects', keywords: 'work repos', run: () => goTo('projects', ctx) },
{ id: 'htb', label: 'Open HackTheBox stats', keywords: 'hacking rank', run: () => goTo('htb', ctx) },
{ id: 'github', label: 'View GitHub activity', keywords: 'code repos stars', run: () => goTo('github', ctx) },
{ id: 'contact', label: 'Go to Contact', keywords: 'email social', run: () => goTo('contact', ctx) },
{ id: 'terminal', label: 'Launch terminal', hint: '`', keywords: 'shell console', run: () => { ctx.close(); ctx.openTerminal(); } },
{ id: 'gh-ext', label: 'Open GitHub profile', keywords: 'external', run: () => openExternal('https://github.com', ctx) },
```

Helper functions:
- `goTo(id, ctx)` — closes palette, scrolls to element with smooth behavior
- `openExternal(url, ctx)` — closes palette, opens URL in new tab

Section IDs must exist: 'hero', 'skills', 'projects', 'htb', 'github', 'contact' (verified in other tasks).

**Build** and **commit**: `feat(ui): add command registry + filter for command palette`
