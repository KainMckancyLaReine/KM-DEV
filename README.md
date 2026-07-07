# KM.dev — Marketing Website

A marketing site for **KM.dev**, a (fictional/portfolio) brand-systems studio. Built as static HTML/CSS/JS — no framework, no build step, no dependencies to install. Open the files directly or serve the folder with any static file server.

Live pages:

| Page | File | Purpose |
|---|---|---|
| Home | `index.html` | Hero, capabilities, projects (top 4), stats, process, CTA |
| Projects | `projects.html` | Full portfolio — every shipped project, linked from "See all projects →" on the homepage |
| Pricing | `pricing.html` | Tier cards, comparison table, FAQ |
| About | `about.html` | Positioning/philosophy, stats, values, process, CTA |
| Contact | `contact.html` | Contact form, contact details, booking calendar |

---

## Tech stack

- **HTML/CSS/JS** — hand-written, single file per page (styles and scripts inlined, no bundler)
- **Google Fonts** — Space Grotesk, Inter, Space Mono
- **GSAP 3 + ScrollTrigger** (via cdnjs) — entrance animations, scroll-triggered stagger reveals, magnetic buttons, 3D tilt on project/value cards
- **Vanilla JS** — hamburger nav, pricing modal, booking-calendar widget (month/week view), scroll-reveal text effect, animated counters
- No React, no npm, no package.json — this is intentional, it keeps the site trivially deployable to any static host (GitHub Pages, Netlify, Vercel, S3, etc.)

## File structure

```
Kmap_Modern landingpage/
├── index.html              ← homepage (canonical entry point)
├── projects.html           ← full project portfolio
├── pricing.html
├── about.html
├── contact.html
├── km-dev-mark.svg         ← favicon / square logo mark
├── km-dev-logo.svg         ← full logo lockup (icon + wordmark)
├── sitemap.xml
├── robots.txt
├── README.md
├── foto's/
│   ├── nexafoto.png              ← real screenshot, NEXA project card
│   ├── kainmckancylareinefoto.png ← real screenshot, portfolio project card
│   └── huizefeniks.png            ← real screenshot, Huize Feniks project card
├── Kmap.html               ← legacy duplicate of the homepage, kept for
│                             backward compatibility, no longer linked from
│                             anywhere — safe to delete once you're sure
│                             nothing external points to it
├── kmap.png, kmap1.png     ← old logo assets, unreferenced, safe to remove
```

## Projects

The homepage `#projects` section shows a curated top **4** (capped intentionally so the grid never gets crowded). `projects.html` shows **all** shipped projects — currently the same 4 plus Huize Feniks — and is where any new project should go once the homepage grid is at 4. Both pages use the identical `.project-card` component, so a card can be copy-pasted between them freely.

Each card links out to the real, live project and uses a real screenshot of that project as its image:

1. **Wildcore Retreats** — [kainmckancylareine.github.io/Wildcore-concept1](https://kainmckancylareine.github.io/Wildcore-concept1/) — outdoor/trail-running retreat concept (image via live thum.io screenshot) — *homepage + projects.html*
2. **NEXA** — [kainmckancylareine.github.io/NEXA](https://kainmckancylareine.github.io/NEXA/index.html) — AI workforce OS dashboard concept (image: `foto's/nexafoto.png`) — *homepage + projects.html*
3. **Kain Mckancy La Reine** — [kainmckancylareine.github.io/Mckancy.mc](https://kainmckancylareine.github.io/Mckancy.mc/) — personal portfolio (image: `foto's/kainmckancylareinefoto.png`) — *homepage + projects.html*
4. **TJEZ Photography** — [kainmckancylareine.github.io/tjez-photo](https://kainmckancylareine.github.io/tjez-photo/index.html) — photography studio site (image via live thum.io screenshot) — *homepage + projects.html*
5. **Huize Feniks** — [kainmckancylareine.github.io/huize-feniks-concept](https://kainmckancylareine.github.io/huize-feniks-concept/) — music academy &amp; studio brand (image: `foto's/huizefeniks.png`) — *projects.html only*

Two cards use [thum.io](https://www.thum.io/) — a free screenshot-as-a-service — to render a live screenshot on every page load (`https://image.thum.io/get/width/1200/crop/900/<url>`). If a target site changes or thum.io is unreachable, swap that `<img src>` for a static image in `foto's/` the same way NEXA and the portfolio card already work.

## Design system

- Colors, spacing and radius are defined as CSS custom properties in `:root` at the top of each page's `<style>` block (`--bg`, `--ink`, `--accent`, `--line`, etc.) — change them once per file to re-theme.
- Icons are inline SVG (no icon font, no emoji anywhere in the UI) — consistent 1.6–1.8px stroke, `currentColor`, rounded caps/joins.
- Layout patterns borrowed from the `klik.agency` reference brief: floating pill nav, fullscreen hamburger menu overlay, floating quick-action buttons, two-tone headings, stacked/tilted photo cards in the hero, word-by-word scroll-color reveal on body copy.

## Animations (GSAP)

All GSAP code lives at the bottom of each page's `<script>` block:

- Page-load entrance timeline for the nav and hero (staggered fade/slide-up)
- `ScrollTrigger`-based stagger reveals for every grid section (capabilities, projects, stats, process, values, footer, contact info)
- A scrub-synced word-by-word color reveal on the intro paragraphs
- Magnetic hover on all primary/secondary buttons
- 3D tilt-on-hover for project cards (home) and value cards (about)

**Important implementation detail:** all `ScrollTrigger` setup is deferred until the browser's `load` event (i.e. after every image has finished downloading), with an explicit `ScrollTrigger.refresh()` call afterwards. Screenshot-heavy sections (like Projects) can shift the page's height significantly as images load; calculating scroll-trigger positions too early is the single most common cause of "a section never appears" bugs with GSAP. If you add more images or sections, keep new scroll-triggered animations inside the existing `initScrollReveals()` function rather than running them at the top of the script.

## Mobile responsiveness

Each page has five responsive tiers: `1000px`, `860px`, `600px`, `480px`, and `360px`. Below 600px the floating nav/quick-action buttons move closer to the screen edge, the booking calendar switches to horizontal scroll (`overflow-x:auto`) instead of crushing its 7-day grid, and type scale steps down twice more (480px, 360px) so headlines never wrap awkwardly on small phones. `viewport-fit=cover` + a `theme-color` meta tag are set on every page for notched devices and mobile browser chrome coloring.

## SEO

Every page ships with:

- Unique `<title>` and meta description
- `<link rel="canonical">`
- `robots` meta (`index, follow`)
- Open Graph + Twitter Card tags (title, description, image, url)
- JSON-LD structured data (`ProfessionalService` on the homepage, `AboutPage` / `ContactPage` on the other two)
- `sitemap.xml` and `robots.txt` at the project root

**Before going live**, replace the placeholder domain `https://www.km.dev/` in the following files with your real deployed URL: `index.html`, `projects.html`, `pricing.html`, `about.html`, `contact.html`, `sitemap.xml`, `robots.txt`. (Find-and-replace `www.km.dev` across the folder.)

## Known limitations / next steps

- The booking calendar and contact form are front-end only — "Confirm Booking" and "Send message" show a success state but don't send anything anywhere. Wire them up to a real backend, form service (Formspree, Basin), or calendar API (Cal.com, Calendly embed) before relying on them for real leads.
- The two thum.io-powered project screenshots regenerate on a cache cycle; if a target site's design changes, the card image updates automatically within a day or so.
- `Kmap.html`, `kmap.png`, and `kmap1.png` are legacy files kept only for safety — nothing links to them anymore, they can be deleted once you've confirmed nothing external (bookmarks, shared links) depends on the old filename.
- No analytics are wired up. If you want visit tracking, add Plausible/Fathom/GA4's snippet to the `<head>` of all three pages.

## Credits

- Photography: [Unsplash](https://unsplash.com) (hero/about/contact imagery)
- Screenshots: [thum.io](https://www.thum.io/) (Wildcore, TJEZ project cards)
- Fonts: [Google Fonts](https://fonts.google.com) — Space Grotesk, Inter, Space Mono
- Animation: [GSAP](https://gsap.com) + ScrollTrigger
