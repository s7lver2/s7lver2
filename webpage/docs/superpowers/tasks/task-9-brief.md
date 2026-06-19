# Task 9: Visual Refinement Across Sections

**Modify:** `app/components/sections/*.tsx` (Hero, Skills, Projects, HTB, Contact, Footer)

For each section:

1. Add to `<section>` element: `className="section"`
2. Wrap container in: `<div className="container-page">`
3. Use `const reveal = useReveal();` hook
4. Wrap main content in `<div ref={reveal} className="reveal">...</div>`
5. Add `.card-hover` to any card/clickable elements in the section
6. Ensure section has correct `id` (hero, skills, projects, htb, contact)

Specific details:
- **Hero**: id="hero", apply reveal to main title/CTA block, card-hover on tech grid items
- **Skills**: id="skills", reveal on skill cards, card-hover on each
- **Projects**: id="projects", reveal on project grid, card-hover on each
- **HTB**: id="htb", keep existing fetch logic, add reveal + card-hover
- **Contact**: id="contact", reveal on contact cards, card-hover on each
- **Footer**: id="footer" (optional), review spacing/consistency

Import `useReveal` at top of each file: `import { useReveal } from '@/lib/reveal';`

**Build** and **commit**: `feat(ui): apply direction-A visual refinement across sections`
