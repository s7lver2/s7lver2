# Task 7: ⌘K navigate → 2-column ASCII-left

Reorder CommandPalette.tsx navigate tab: search on top, then 2-col row (ASCII left ~230px + list right), hints bottom. Replace current navigate JSX block with:

```tsx
{tab === 'nav' && (
  <>
    <div className="ccq-wrapper"><input ref={inputRef} onKeyDown={handleKeyDown} className="ccq" placeholder="Navigate sections..." autoComplete="off" spellCheck={false} /></div>
    <div className="ccnav-body">
      <div className="palart"><pre className="text-xs leading-tight overflow-hidden">{asciiArt || 'No art loaded'}</pre></div>
      <div className="pallist">
        {SECTIONS.map((section, idx) => (
          <button ref={idx === selectedIdx ? selectedRef : null} key={section.id} onClick={() => { const el = document.getElementById(section.id); if (el) { el.scrollIntoView({ behavior: 'smooth' }); onClose(); } }} className={`li ${idx === selectedIdx ? 'li-selected' : ''}`} >
            <span className="li-label">{section.label}</span>
            <span className="li-hint">{section.href}</span>
          </button>
        ))}
      </div>
    </div>
    <div className="palfoot"><span className="flex items-center gap-1"><FaArrowUp className="text-[10px]" /><FaArrowDown className="text-[10px]" /><span>navigate</span></span><span>↵ go</span><span>Tab terminal</span><span>esc close</span></div>
  </>
)}
```

In `app/globals.css`, add:

```css
/* ⌘K navigate — two columns (ASCII left like social) */
.ccnav-body { display: flex; gap: 22px; padding: 18px; }
.ccnav-body .palart { flex-shrink: 0; width: 230px; display: flex; align-items: center; justify-content: center; }
.ccnav-body .pallist { flex: 1; }
@media (max-width: 600px) { .ccnav-body { flex-direction: column; } .ccnav-body .palart { width: 100%; } }
```

Verify: ⌘K → navigate tab shows search on top, ASCII left, list right. Hints bottom. ↑↓ selects, Tab → terminal. Mobile: stacks.

Commit: `feat(cmdk): navigate panel as two columns (ASCII left, list right) like social`
