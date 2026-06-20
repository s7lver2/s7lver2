# Task 8: Public sections read KV + event tracking — Report

**Status:** DONE

## Implementation Summary

### 1. Event Tracking Library
- Created `app/lib/track.ts` with `track(type, extra?)` function that POSTs to `/api/event` with keepalive=true, silent on error.

### 2. KV Fetch + Fallback Pattern
- **Projects.tsx**: Fetches `/api/content/projects` → DEFAULT_PROJECTS fallback. Component state uses projects array; event tracking on project selection.
- **Social.tsx**: Fetches `/api/content/socials` → DEFAULT_SOCIALS fallback. Maps defaults with avatar URLs; lazy-loads ASCII from images or generates from gradient.
- **Hero.tsx**: Fetches `/api/content/home` → DEFAULT_HOME fallback. Renders dynamic title/subtitle from fetched data.

### 3. Event Hooks
- **page.tsx**:
  - `cmdk_open` fired on ⌘K (nav tab) or backtick (term tab) key press
  - `scroll_depth` fired throttled on scroll (200ms), once per section per page load, tracks deepest visible section + scroll % depth
- **Projects.tsx**: `project_click` fired when project row clicked (if .web URL exists)
- **TerminalPanel.tsx**: `terminal_cmd` fired after command processed, captures first word of command

### 4. Code Quality
- All TypeScript types updated; optional properties handled (langs, web, stars, forks, avatar).
- Build passes; no compilation errors.

## Commits
- `08c4135` feat(content): public sections read from KV with fallback; client event tracking

## Test
- Build passes with no errors; POST /api/event requests will be sent on cmdk_open, scroll_depth, project_click, and terminal_cmd events.

## Concerns
- No server-side event handler endpoint yet (Task 3 creates `/api/event` but no logic verified for consumption).
- Scroll tracking only fires once per section per page load (guard via Set); subsequent scrolls to same section won't re-fire.
