---
kind: frontend_style
name: 'Phoenix Frontend: CSS Variables + Utility-First Global Styles (No Framework)'
category: frontend_style
scope:
    - '**'
source_files:
    - phoenix-frontend/src/app/globals.css
    - phoenix-frontend/package.json
    - phoenix-frontend/next.config.mjs
    - phoenix-frontend/src/components/Sidebar.tsx
    - phoenix-frontend/src/components/NavBar.tsx
---

## Approach

The Phoenix frontend (`phoenix-frontend/`) is a Next.js 14 App Router application that styles itself with **plain CSS** — no CSS-in-JS library, no Tailwind, no component library. All visual styling lives in a single global stylesheet `src/app/globals.css`, imported by the root layout.

There is no `tailwind.config.*`, no PostCSS plugin configuration for a utility framework, and no third-party UI kit referenced in `package.json`. The only runtime dependencies are `next`, `react`, `react-dom`, and `date-fns`.

## Design Tokens

Tokens are defined as CSS custom properties on `:root` in `globals.css`:

- **Colors**: `--bg` (#f4f5f8), `--fg` (#1b2130), `--muted` (#667085), `--card` (#ffffff), `--border` (#e4e7ec), `--accent` (#e8590c), `--accent-dark` (#c94a08), `--accent-soft` (#fff1e6), `--error` (#c92a2a), `--ok` (#2b8a3e).
- **Spacing / sizing**: `--radius: 10px`, `--nav-h: 64px`, `--side-w: 248px`.
- **Shadows**: `--shadow-sm`, `--shadow-md`.
- **Easing**: `--ease: cubic-bezier(0.22, 1, 0.36, 1)`.

Typography defaults to `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`; headings get explicit sizes; links use the accent color with hover transitioning to `--accent-dark`.

## Layout System

Layout is built from a small set of semantic class names (BEM-like but without strict nesting):

- `.nav` — sticky top bar with `backdrop-filter: blur(8px)`, height driven by `--nav-h`.
- `.shell` — flex container pairing sidebar and main content.
- `.sidebar` — fixed-width left rail (`--side-w`), sticky below the nav, scrollable.
- `.container` — main content area, max-width 1040px, centered, animated via `page-in`.
- `.card`, `.panel`, `.hint` — reusable content containers sharing border/shadow/radius tokens.

Components compose these classes rather than defining their own layout rules:
- `NavBar.tsx` renders `<header className="nav">` with a `.brand` link and `.nav-right` actions.
- `Sidebar.tsx` renders `<aside className="sidebar">` with `.side-title`, `.side-link` (with `.active` modifier), and `.side-hint`.

## Component Styling Conventions

- Components are styled via plain CSS class names applied directly in JSX (`className="side-link active"`, `className="secondary"`).
- Iconography is inline SVG paths defined as a local map inside `Sidebar.tsx` and rendered through a shared `<Icon>` wrapper.
- Buttons follow a primary/secondary pattern: default buttons use `--accent` background; `.secondary` overrides to a neutral surface with a border.
- Form inputs/selects share a base style with an accent-colored focus ring (`box-shadow: 0 0 0 4px rgba(232, 89, 12, 0.14)`).
- Status indicators use `.badge.done` / `.badge.doing` modifiers over a base `.badge` class.
- A modal system uses `.modal-backdrop` + `.modal` with sticky header behavior.

## Animations & Motion

Keyframes are declared at the bottom of `globals.css`: `page-in`, `slide-in`, `fade`, `pop`, `grow`, `ping`. Transitions consistently use the `--ease` cubic-bezier token. An `@media (prefers-reduced-motion: reduce)` rule disables all animations/transitions for accessibility.

## Responsive Strategy

A single breakpoint at `max-width: 860px` switches the layout:
- `.shell` becomes columnar.
- `.sidebar` collapses to a horizontal row above the content (hides titles/hints, removes sticky positioning).
- Inputs go full-width; `.narrow` card shrinks padding.
- Modal padding tightens.

No other breakpoints exist — this is a mobile-first-ish approach with one tablet breakpoint.

## Configuration

`next.config.mjs` enables `appDir` under `experimental` (Next.js 14) and sets `reactStrictMode: true`. There is no CSS-related config (no PostCSS plugins, no Tailwind config). Fonts are loaded via the Inter font family name in CSS; no `next/font` usage is present.

## Constraints Observed

- No CSS framework or component library is installed or configured — styling is hand-written CSS.
- All styles live in `src/app/globals.css`; there are no per-component `.css` files.
- Design tokens are centralized exclusively as CSS custom properties on `:root`.
- Responsive behavior is handled via a single `@media (max-width: 860px)` block.
- Accessibility: focus-visible outlines use the accent color; reduced motion is respected; icons carry `aria-hidden="true"`.
