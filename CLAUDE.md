# AG Records: Anika Giri's portfolio

## Concept

AG Records is a record label where nothing ships until it's checked. Anika is the mastering engineer: the last stage before release, catching what's wrong while there's still time. That is what her projects do (double-blind catches evaluations that lie, tripwire catches actions an agent was tricked into, cloudscape catches incidents before they become post-mortems). Every project is a release with a catalog number (AG-001, AG-002). Ag is the symbol for silver, so the label is silver. Physical media only: vinyl, labels, liner notes, sleeves. No streaming-app references.

## Stack

Astro, static output. Waveforms are generated at build time from each repo's git history, filtered to Anika's own commits. Project clips are short muted looping .webm/.mp4, not GIFs.

## Writing rules

- Never use em dashes or en dashes anywhere in site copy. Use periods, commas, colons, or parentheses.
- No marketing filler ("passionate," "innovative," "leveraging"). Short and specific.
- No emoji. No "Hi, I'm Anika" hero.
- Do not add code comments unless asked.

## Visual rules

- Palette: ink #111214, sleeve #1B1C20, silver #B9BEC6, foil #E9ECEF, accent vermillion #E8442E (sparingly).
- Banned: cream or beige backgrounds, terracotta or coral orange, purple-blue gradients, glassmorphism, floating blobs, generic rounded card grids, text over busy imagery.
- Fonts: no Inter, Roboto, Arial, system defaults, or Instrument Serif.
- Body text always sits on flat color and passes WCAG AA contrast.
- Motion is physical (weight, inertia, easing, no bounce). Respect prefers-reduced-motion.

## Workflow

- Before calling any UI task done, take screenshots at desktop and mobile widths, critique them against this file, and fix what's off.
- Run `npm run check:dashes` before finishing any task. It must pass.
- Commit at each meaningful boundary with a clear message.

## Commands

Node is pinned in `.nvmrc`. The system Node on this machine is older than Astro requires, so every npm command needs the nvm version on PATH first:

```
export PATH="$HOME/.nvm/versions/node/v22.23.5/bin:$PATH"
```

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on :4321. Astro daemonizes it, so the command returns immediately. |
| `npx astro dev stop` | Stops it. `astro dev status` and `astro dev logs` also work. |
| `npm run build` | Static output to `dist/`. |
| `npm run commits` | Regenerates `src/data/commits.json` from GitHub. Needs `gh` auth. |
| `npm run check:dashes` | Fails if any em or en dash is in `src` or `public`. |

## Structure

- `src/data/catalogue.ts` holds all site copy. Edit words there, never in components.
- `src/data/commits.json` is committed on purpose, not generated during `npm run build`: deploys then need no network and no GitHub token, and builds stay reproducible.
- `scripts/fetch-commits.mjs` counts only commits authored by `anikag35`. A waveform including other people's work would be a lie. Do not change this.
- Tracks are `<details>`/`<summary>`, not a JavaScript accordion, so content is never behind an interaction and in-page find works.

## Open items

- Clips for tripwire, double-blind, cloudscape (Anika records these)
- Real playlist links in About (currently #)
- Email link in Get in touch (held back until Anika approves publishing her address)
