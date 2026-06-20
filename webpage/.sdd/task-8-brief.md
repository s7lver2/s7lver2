# Task 8: Projects/Social/Hero consume KV (with fallback) + event hooks

**Tasks:**

1. **Projects/Social/Hero consume KV**: Replace hardcoded constants with fetch + fallback pattern (same as Skills in Task 4). Projects.tsx fetches `/api/content/projects` → DEFAULT_PROJECTS fallback. Social.tsx fetches `/api/content/socials` → DEFAULT_SOCIALS fallback. Hero.tsx fetches `/api/content/home` → DEFAULT_HOME fallback.

2. **Create `app/lib/track.ts`** (shared event tracking):

```ts
export function track(type: string, extra?: Record<string, unknown>) {
  try {
    fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...extra }), keepalive: true });
  } catch {}
}
```

3. **Wire events in `app/page.tsx`**:
   - Import track util.
   - Call `track('cmdk_open', { detail: paletteTab })` when palette opens (in ⌘K/backtick handlers).
   - On scroll (throttled), compute deepest visible section + page depth % → `track('scroll_depth', { section, depth })` (once per section per page load, guard with Set).

4. **Wire events in `app/components/sections/Projects.tsx`**:
   - Import track.
   - On project card click that opens `web`, call `track('project_click', { detail: slug })`.

5. **Wire events in `app/components/TerminalPanel.tsx`**:
   - Import track.
   - In run(raw) function, after command is processed, call `track('terminal_cmd', { detail: raw.split(' ')[0] })`.

**Verification:**
- Build passes.
- No new errors.
- POST /api/event endpoints work (checked in Task 3).

**Commit:** `feat(content): public sections read from KV with fallback; client event tracking`
