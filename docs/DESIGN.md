---
version: beta
name: Collision Canary
description: A warm, friendly interface for a serious idea. Two real users, one shared seat, one honest proof.
theme: playful-consumer
colors:
  canvas: "#F3EFE8"
  card: "#FFFFFF"
  ink: "#272C34"
  muted: "#6E7582"
  primary: "#2E8BFF"
  primaryPress: "#1E7CF5"
  secondary: "#E8E5DF"
  border: "#E7E3DB"
  accentPurple: "#A855F7"
  accentSky: "#38BDF8"
  accentIndigo: "#6366F1"
  waiting: "#F5B93B"
  collision: "#F0563A"
  verified: "#1FB981"
  dot: "#DBD6CC"
  focus: "#2E8BFF"
typography:
  display:
    fontFamily: Geist
    fontWeight: 800
    letterSpacing: "-0.03em"
    lineHeight: 1.02
  h2:
    fontFamily: Geist
    fontWeight: 800
    letterSpacing: "-0.02em"
    lineHeight: 1.08
  body:
    fontFamily: Geist
    fontWeight: 400
    lineHeight: 1.5
  eyebrow:
    fontFamily: Geist Mono
    fontWeight: 600
    fontSize: 0.64rem
    letterSpacing: "0.08em"
    textTransform: uppercase
  data:
    fontFamily: Geist Mono
    fontWeight: 500
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  section: 88px
shadow:
  card: "0 10px 26px rgba(30,40,60,0.08)"
  raised: "0 14px 40px rgba(30,40,60,0.10)"
  button: "0 6px 14px rgba(46,139,255,0.28)"
---

## Overview

Collision Canary is a friendly, consumer grade interface for a serious engineering idea. It drives two real browsers at the exact same moment and proves whether an app keeps a simple promise: only one person can take the last seat.

The tone is warm and playful, not stark. Cream canvas, soft dot grid, white cards with gentle shadows, one vivid blue for action, and colored icon tiles for personality. The substance stays honest: every number and ID on screen is a real database record, and the word verified only appears after a full pass.

The emotional hook is unchanged: two people can each have a perfectly green journey and still leave one broken system.

This document replaces the earlier dark diagnostic direction. The product logic, copy meaning, and honesty rules carry over. The visual skin is new.

### Brand core

- Name: Collision Canary
- Tagline: Catch the bug only two users can make.
- One line position: Two real browsers, one shared seat, one honest proof that only one user can win.
- Audience: product engineers, founders, SDETs, and hackathon judges.
- Personality: friendly, clear, playful, and honest about what a proof does and does not cover.

### Logo direction

A rounded canary beak mark in warm amber next to the wordmark. Readable at 16px. No generic CC monogram, no robot face, no shield, no checkmark badge.

## Colors

- Canvas `#F3EFE8`: warm cream page background with a subtle dot grid.
- Card `#FFFFFF`: panels, nav pill, feature cards, proof cards.
- Ink `#272C34`: headlines and primary text.
- Muted `#6E7582`: secondary copy and metadata.
- Primary `#2E8BFF`: the single action color for primary buttons and links. Press state `#1E7CF5`.
- Secondary `#E8E5DF`: soft gray for secondary buttons and the eyebrow pill.
- Border `#E7E3DB`: light hairlines between surfaces.
- Accent tiles: purple `#A855F7`, sky `#38BDF8`, indigo `#6366F1`. Used only on icon tiles for personality, never as status.
- Waiting `#F5B93B`: amber, used only while actors wait at the barrier.
- Collision `#F0563A`: soft coral, used only for a proven invariant violation.
- Verified `#1FB981`: emerald, used only for a fully verified pass.

Status colors are meaningful. Amber is waiting, coral is a real collision, emerald is a real pass. Do not use coral or emerald decoratively.

## Typography

Geist for product and marketing copy, weight 800 for display and section headlines with tight tracking. Geist Mono for run IDs, actor names, timestamps, counts, invariant keys, and reason codes. A friendlier display face such as General Sans or Satoshi is an acceptable upgrade for headlines if added to the pipeline. Mono is an accent, never body.

Rules:

- Headlines are bold and can be centered on marketing surfaces, left aligned in the app.
- Body copy stays readable, under about 60 characters per line on marketing surfaces.
- The word verified appears only for a complete terminal pass.
- No em dashes anywhere in copy. Use periods, commas, or parentheses.

## Layout

- Marketing pages: centered, max width 1100px, generous section spacing.
- Product pages: max width 1200px, top bar navigation.
- Canvas uses the cream background plus a subtle radial dot grid at about 22px spacing.
- Cards are allowed and encouraged. Depth comes from soft shadows and light hairlines, not dark borders.
- Section spacing about 88px desktop, 64px tablet, 48px mobile.

### Responsive behavior

- Below 720px, the nav pill collapses to brand plus primary action, and links move to a menu.
- Feature and step grids stack to one or two columns.
- Proof before and after stacks vertically, verdict first.
- Every primary control stays at least 44px high.

## Components

### Nav pill

Floating white pill with soft shadow. Left: beak mark plus wordmark. Center: Product, How it works, Proof. Right: primary button Run a live test.

### Buttons

- Primary: blue `#2E8BFF`, white text, radius 12px, soft blue shadow. Press `#1E7CF5`.
- Secondary: soft gray `#E8E5DF`, ink text, radius 12px.
- Every button is filled and performs a real action. No ghost or outline only buttons. Disabled buttons explain why.

### Eyebrow pill

Soft gray pill, mono uppercase label, used above headlines.

### Feature card

White card, radius 16px, soft shadow. A 40px colored icon tile at top, a small muted label, a bold title, and one line of plain copy.

### Icon tile

40px rounded square in purple, sky, or indigo, white glyph. Personality only, never status.

### Proof card

White card with a header row: run ID in mono plus a status pill. Body shows two actor tracks as rounded bars, an outcome pill per actor, and a small key value block with real counts. Before and after render side by side on desktop.

### Actor track

A rounded horizontal bar per actor with the actor name in mono and an outcome pill. Coral bar for a collision path, emerald bar for a correct win, neutral bar for a correct rejection.

### Status pill

Soft tinted pill with text. Amber for waiting, coral for collision, emerald for verified. Text is always present. No bare colored dots.

### Form fields

Labels above inputs, always visible. Focus uses a blue ring. Error copy names the corrective action. No placeholder only labels.

### Status language

Use: Preparing actors, Waiting at barrier, Actors released, Checking the promise, Collision found, Fix packet ready, Verified, Something went wrong.

Avoid: magic, smart, autonomous success, demo mode, mock result, AI powered insight.

## Screens

Content and copy are fixed here. Visuals follow the component system above. Every screen uses real records from the live API. Loading, empty, and error states are designed and friendly, never a bare broken state.

### Landing `/`

Sections in order: nav pill, hero, runs on strip, problem, how it works, features, proof, final CTA, footer.

- Eyebrow: MULTI USER BUG DETECTION
- Headline: Catch the bug only two users can make.
- Subcopy: Collision Canary drives two real browsers at the exact same moment, then proves whether your app keeps its promise: only one person can grab the last seat.
- Primary action: Run the last-seat test, routes to `/run`.
- Secondary action: See a real proof, routes to a real `/runs/[id]`.
- Runs on strip: Kane, Neon, Vercel, Codex as monochrome wordmarks. Honest tooling, not fake customers.
- Problem: Your tests pass. Your users still collide.
- How it works: Arm, Release, Check, Repair, with colored tiles.
- Features: Real browsers, Real database, Fix packet.
- Proof: a real before and after from an actual run.
- Final CTA: See it collide, then watch it get fixed.

### New Run `/run`

- API: `POST /api/v1/runs` with scenario last-seat-v1 and invariant capacity-at-most-one-v1.
- Copy: Start a paired run. The promise we test: at most one person can claim the final seat.
- States: default, submitting, capacity busy (429), server error (500) with request id.

### Actor Lab `/lab/last-seat#<token>`

- API: arm, barrier poll, claim. Token arrives in the URL fragment and is sent as a bearer header from the client.
- States: waiting at barrier X of 2, released, you won the seat, seat already taken, something went wrong.

### Live Proof `/runs/[runId]`

- API: proof, evaluate, repair-packet.
- Collision copy: winners, recorded claims, seats left, reason non_linearizable_outcome.
- Verified copy: one win, one correct rejection, reason capacity_invariant_satisfied.
- Fix packet: redaction status and sha256, a Copy repair command action. The site never runs Codex for the user.

### Before and After

- API: two proofs linked by a real repair cycle. Renders only when the cycle exists.

### Runs `/runs`

- Needs a new `GET /api/v1/runs` list endpoint, or the nav item is cut for v1.
- Friendly list with real run rows and a designed empty state.

### System `/system`

- Database row backed by `GET /api/v1/health`.
- Kane connection row needs a real check or is scoped out of v1.

## Do and Don't

### Do

- Lead with the promise and the real outcome.
- Use real run IDs, timestamps, and counts everywhere.
- Keep one blue for action and reserve amber, coral, and emerald for real status.
- Design friendly empty, loading, and error states with a real next action.
- Respect reduced motion and keyboard focus.

### Don't

- No mock data, seeded numbers, or fabricated metrics, logos, or testimonials.
- No placeholder text or gray placeholder image boxes.
- No fake charts. Show real counts, tracks, and verdicts.
- No ghost or outline only buttons.
- No broken or empty screen as a default state.
- No em dashes in copy.
- Never put Codex execution behind a public button.
- Never show green before a full verified pass.

## Assets and photography

- Hero: a custom playful illustration of two browsers reaching one seat. Preferred over stock photo.
- Optional human band: a real photo of engineers at laptops. Search query: software engineers collaborating laptop candid.
- Optional problem story: a real last seat moment. Search query: airplane window seat, or concert tickets phone.
- Photo treatment: radius 16px, soft shadow, slight warm tint.
- Photos are sourced from Unsplash with a valid API key and bound at build with correct attribution. No placeholder images ship. Key location is pending from the owner.

## Build rules

1. Build one section or one screen at a time. Do not build the whole page in one pass.
2. Preserve already approved sections exactly. Do not modify sections above or below the current target.
3. Every build step carries the global rules: cream canvas, one blue for action, real status colors only, soft shadows, no em dashes, no ghost buttons, no placeholders, no fake data.
4. Use real backend records as soon as a route exists.
5. Verify each route after implementation before moving on.
6. Keep provider, database, and invariant logic out of visual components.
7. Remove all starter template copy before review.
