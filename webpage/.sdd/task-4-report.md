# Task 4: Skills consumes KV + hover-dim state (shared with carousel) — COMPLETION REPORT

## Status: DONE

## Commits
- f8ca2e0: feat(skills): load from KV + hover-dim active-concept state (+ carousel stub)

## Summary
Task 4 implementation complete. Skills section now:
- Fetches from `/api/content/skills` with DEFAULT_SKILLS fallback
- Manages activeConcept state shared with carousel
- Renders hover-dim effect via CSS with data-active attributes
- Includes Machines.tsx stub (Task 5 will replace)
- Build passes cleanly

## Implementation Details

### Files Modified
1. **app/components/sections/Skills.tsx**
   - Replaced hardcoded AXES with state-driven axes from DEFAULT_SKILLS
   - Added activeConcept state for hover tracking
   - Fetch KV endpoint `/api/content/skills` on mount with fallback
   - Updated helper functions to accept axes parameter
   - Added hover handlers to legend rows (.rl) and radar points (.pt)
   - Added data-c attributes with conceptKey values
   - Integrated MachinesCarousel component stub

2. **app/globals.css** (hover-dim rules)
   - Dim non-active legend rows and radar points
   - Highlight active row with gradient background
   - Smooth transitions with prefers-reduced-motion support

3. **app/lib/content-constants.ts** (new)
   - Client-safe extraction of types and DEFAULT_SKILLS
   - No server-only imports

4. **app/lib/content.ts** (refactored)
   - Re-exports from content-constants for compatibility

5. **app/components/sections/Machines.tsx** (stub)
   - Returns null (placeholder for Task 5)

## Verification
- Build: npm run build passes cleanly
- No console errors
- Types: TypeScript strict mode clean
- CSS: Transitions and prefers-reduced-motion support implemented
- Backward compatibility maintained

## No Concerns
All acceptance criteria met.
