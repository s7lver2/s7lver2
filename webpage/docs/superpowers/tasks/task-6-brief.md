# Task 6: Command Palette (⌘K)

**Create:** `app/components/CommandPalette.tsx`

**Modify:** `app/page.tsx` — add state, ⌘K handler, mount component

Palette component:
- Props: `{ open: boolean; onClose: () => void; onOpenTerminal: () => void }`
- Renders modal overlay with input, command list, keyboard nav
- ↑/↓ navigate, ↵ execute, Esc close
- Input filters results in real-time
- Commands from Task 5 (`buildCommands`, `filterCommands`)

Page.tsx:
- Add state: `const [paletteOpen, setPaletteOpen] = useState(false)`
- Add ⌘K/Ctrl+K handler to existing `useEffect` (before backtick handler)
- Opening palette closes terminal (one overlay at a time)
- Mount: `<CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onOpenTerminal={() => setTerminalOpen(true)} />`

**Build** and **commit**: `feat(ui): add Cmd+K command palette`
