# Studs Theme

Shopify **Horizon** theme with a **Vite** layer for the JS/SCSS we author.

## Two asset pipelines

1. **Horizon native** — files already in `assets/`, loaded via `snippets/scripts.liquid` + `base.css`. Don't hand-edit.
2. **Our Vite pipeline** — everything we author lives in `src/`. Vite compiles it to hashed `vite-*` files in `assets/`, loaded via the generated `vite-tag` snippet.

> **Golden rule:** author in `src/`, never hand-edit `assets/`.

## Prerequisites

- Node 20+ · Shopify CLI 3.77+ · access to `studs-dev.myshopify.com`

## Setup

```sh
npm install
shopify auth login
npm run dev
```

## Structure

```text
src/
  entrypoints/         Vite entries (rendered via vite-tag)
    theme.{js,scss}    Global, every page
    product.js         Route-split (product pages)
    sections/{styles,scripts}/   One bundle per section
  scripts/             Shared JS (money, swiper, breakpoints)
  styles/
    settings/          _tokens, _fonts
    tools/             _focus-ring (mixins)
    components/         _button, _typography, _global
assets/   Vite output + Horizon native assets
blocks/ config/ layout/ locales/ sections/ snippets/ templates/
```

## Daily dev

```sh
npm run dev   # shopify theme dev + vite together
```

- Open the **local** preview `http://127.0.0.1:9292` — HMR only works there (not the `*.myshopify.com` URL).
- Don't run `npm run build` while developing — it's a deploy step.
- Edit `src/**` → Vite HMR. Edit `.liquid`/config → theme-dev reload.
- Separately: `npm run shopify:dev` / `npm run vite:dev`.

## Loading assets

Render `vite-tag` with an entry filename; where you render decides where it loads.

```liquid
{% comment %} global → layout/theme.liquid {% endcomment %}
{% render 'vite-tag', entry: 'theme.js' %}

{% comment %} route-specific → theme.liquid, gated {% endcomment %}
{% if request.page_type == 'product' %}{% render 'vite-tag', entry: 'product.js' %}{% endif %}

{% comment %} section-specific → inside the section {% endcomment %}
{% render 'vite-tag', entry: 'sections/scripts/my-section.js' %}
```

A new entry = any new file in `src/entrypoints/`. A JS entry importing its own `.scss` emits both `<script>` and `<link>`.

## Styling

Flow: **tokens → components → `theme.scss`**.

- **Tokens** ([`_tokens.scss`](src/styles/settings/_tokens.scss)) — primitives + semantic aliases. Components use `var(--token)` only; never hardcode hex/px.
- **Components** — class-based, self-contained ([`_button.scss`](src/styles/components/_button.scss), [`_typography.scss`](src/styles/components/_typography.scss)).
- Add one: create `src/styles/components/_thing.scss`, then `@use '../styles/components/thing';` in [`theme.scss`](src/entrypoints/theme.scss).

## Build & deploy

```sh
npm run build        # prettier + vite build + clean, regenerates vite-tag.liquid
shopify theme push
```

> **Always build before pushing.** In dev, `vite-tag.liquid` points at `localhost:5173`; pushing in that state breaks the live store. Build rewrites it to hashed CDN assets.

- `npm run build` runs `clean` afterwards to prune stale `vite-*` files (Vite keeps `emptyOutDir: false`, so old hashes pile up). Run `npm run clean` anytime — only touches `vite-*`, never Horizon assets.
- Delete `assets/.vite/` if it appears — Shopify rejects subfolders in `assets/`.

## Git workflow

Work flows **upward only** — no direct pushes.

```text
feat/* · fix/*  →  staging  →  main
```

| Branch           | Theme                        | Merged via                         |
| ---------------- | ---------------------------- | ---------------------------------- |
| `main`           | live / prod, tagged releases | PR from `staging`, senior approval |
| `staging`        | QA / UAT theme               | PR from `feat/*` · `fix/*`         |
| `feat/*` `fix/*` | local `theme dev`            | branch off `staging`               |

- Branch off `staging`, PR back into `staging`. Promote to `main` only after QA sign-off.
- **Tag every deploy** (`v1.4.0`) for rollback. Back up the live theme before publishing.
- Hotfix: `hotfix/*` off `main` → PR → `main`, then back-merge into `staging`.
- Names: `feat/pdp-sticky-add-to-cart`, `fix/cart-drawer-focus-trap`, `hotfix/checkout-button-disabled`.

### Commits — Conventional Commits

`type(scope): subject` — imperative, lowercase, ≤72 chars. Scope = section/component.

| Change          | Commit                                                   |
| --------------- | -------------------------------------------------------- |
| Section bug     | `fix(shop-the-look): correct mobile slider overflow`     |
| New section     | `feat(pierce-promo): add promo banner section`           |
| Theme component | `feat(header): build sticky header with mega menu`       |
| Restructure     | `refactor(header): extract nav into header-menu snippet` |
| Style only      | `style(button): align hover token to design`             |
| Perf            | `perf(home): lazy-load below-fold media`                 |
| Tooling         | `chore(build): prune stale vite assets on build`         |

Avoid: `update`, `fix`, `final2`, `Update header.liquid`.

## npm scripts

| Script                     | Does                        |
| -------------------------- | --------------------------- |
| `dev`                      | theme dev + vite (HMR)      |
| `shopify:dev` / `vite:dev` | each watcher alone          |
| `format` / `format:check`  | Prettier write / check      |
| `theme:check`              | `shopify theme check`       |
| `clean`                    | prune stale `vite-*` assets |
| `build`                    | format + vite build + clean |
