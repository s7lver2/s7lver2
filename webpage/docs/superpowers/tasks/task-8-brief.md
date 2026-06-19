# Task 8: Terminal v2

**Modify:** `app/components/Terminal.tsx`

Enhance command processor with:

1. **New commands:**
   - `github` → returns ["Fetching GitHub summary…", "See GitHub section or: open github"]
   - `htb` → returns ["HackTheBox stats in #htb section. Try: open htb"]
   - `open <section>` → validates section (hero/skills/projects/htb/github/contact), closes terminal, scrolls to it
   - `help` → update to list new commands

2. **Tab autocompletion:**
   - In `onKeyDown`, detect Tab
   - Get list of command names
   - Filter matching start of current input
   - If exactly one match, auto-complete
   - Example: type `pro` + Tab → completes to `projects`

3. **Keep existing:**
   - Backtick toggle
   - Histor­y (↑/↓)
   - `cat flag.txt` easter egg
   - `clear` command
   - All existing commands

**Build** and **commit**: `feat(ui): terminal v2 — tab autocomplete and new commands`
