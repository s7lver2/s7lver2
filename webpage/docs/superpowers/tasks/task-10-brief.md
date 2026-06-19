# Task 10: Documentation + Final Verification

**Modify:** `README.md`

Add section documenting:
- New env var `GITHUB_USERNAME` (required for GitHub section)
- New env var `GITHUB_TOKEN` (optional, for higher GitHub API rate limit)
- New keyboard shortcuts: ⌘K / Ctrl+K (command palette), `` ` `` (terminal), scroll-spy in navbar
- GitHub section location in the page

Final verification (manual + build):

1. Run `npm run build` → must pass without errors
2. Run `npm run dev` with:
   - `GITHUB_USERNAME=s7lver` in `.env.local`
3. Manual checklist:
   - ✅ Direction A visible (spacing, typography, hover effects)
   - ✅ ⌘K opens command palette, filters work, navigation works
   - ✅ Navbar highlights active section on scroll
   - ✅ Terminal: Tab autocompletes, new commands work
   - ✅ GitHub section loads and displays (if GITHUB_USERNAME set)
   - ✅ Mobile viewport works, reduces-motion respected
   - ✅ All pages load without errors, no console errors

**Commit**: `docs: document Phase 1 env vars, shortcuts and GitHub section`

**Return status: DONE when all above pass**
