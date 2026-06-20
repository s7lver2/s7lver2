# Task 3 Report: Events ingest + feature flags + theme

**Status:** DONE

**Commits:**
- 22cfd77 - feat(data): event ingest + summary, feature flags + theme in settings, public /api/flags

**Test Summary:**
All endpoints tested and working: POST /api/event (with valid/invalid types), GET /api/flags returns flags and theme correctly.

**Implementation Details:**

1. **Extended SiteSettings** (app/lib/settings.ts):
   - Added `flags: { terminal, machines, timeline, maintenance }` with defaults
   - Added `theme: 'morado' | 'azul' | 'verde' | 'mono'` with default 'morado'
   - Updated getSettings() to merge flags with defaults

2. **Created events module** (app/lib/events.ts):
   - AppEvent interface with type, detail, section, depth, ts
   - readEvents() and addEvent() for KV store operations
   - summarizeEvents() calculates cmdkOpens, terminalCmds, avgScrollDepth, readFullPct, scrollBySection, and recent (30 most recent)
   - MAX=2000 event limit enforced

3. **Created event ingest endpoint** (app/api/event/route.ts):
   - POST endpoint validates against ALLOWED set (cmdk_open, terminal_cmd, scroll_depth, project_click)
   - Sanitizes detail (80 chars), section (40 chars), depth (0-100, rounded)
   - Returns 400 for invalid types, 200 with {ok: true} for valid events

4. **Created flags endpoint** (app/api/flags/route.ts):
   - GET endpoint returns flags and theme from settings
   - Includes Cache-Control headers (30s max-age, 120s stale-while-revalidate)

**Verification:**
- Build completes successfully with both /api/event and /api/flags routes
- POST /api/event with valid type returns {"ok":true}
- POST /api/event with invalid type returns 400
- GET /api/flags returns {"flags":{...},"theme":"morado"}
