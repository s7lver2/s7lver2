# Task 7: Navbar — Scroll-Spy + GitHub Link + ⌘K Hint

**Modify:** `app/components/Navbar.tsx`

Add scroll-spy:
```tsx
const [activeId, setActiveId] = useState('hero');

useEffect(() => {
  const ids = ['hero', 'skills', 'projects', 'htb', 'github', 'contact'];
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) setActiveId(e.target.id);
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });
  return () => io.disconnect();
}, []);
```

In nav render:
- Add `id="github"` link to GitHub section (between projects and contact, or as needed)
- Apply active class when `activeId === id` (follow existing pattern for color/style)
- Add hint: `<span className="hidden md:inline-flex items-center gap-1 font-mono text-[11px] text-gray-500 border border-white/10 rounded px-2 py-1">⌘K</span>` near search/action area

**Build** and **commit**: `feat(ui): navbar scroll-spy, GitHub link and Cmd+K hint`
