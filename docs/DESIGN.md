---
version: alpha
name: Collision Canary
description: A compact diagnostic interface for synchronized browser actors and shared-state invariant proof.
colors:
  primary: "#F6D84A"
  background: "#090B0F"
  surface: "#11151B"
  surfaceRaised: "#171C23"
  border: "#29323D"
  signal: "#F6D84A"
  danger: "#FF5D62"
  success: "#45D39A"
  text: "#F3F5F7"
  textMuted: "#8C97A5"
  focus: "#FFF1A6"
typography:
  h1:
    fontFamily: Geist
    fontSize: 3.5rem
    fontWeight: 650
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  h2:
    fontFamily: Geist
    fontSize: 2rem
    fontWeight: 620
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  body:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "-0.005em"
  label:
    fontFamily: Geist Mono
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.06em"
  data:
    fontFamily: Geist Mono
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0em"
rounded:
  sm: 4px
  md: 8px
  lg: 12px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  section: 96px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.focus}"
    textColor: "{colors.background}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  button-secondary:
    backgroundColor: "{colors.surfaceRaised}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 24px
  metadata:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.textMuted}"
    typography: "{typography.data}"
    rounded: "{rounded.sm}"
    padding: 8px
  divider:
    backgroundColor: "{colors.border}"
    textColor: "{colors.text}"
    height: 1px
    width: 100%
  status-waiting:
    backgroundColor: "{colors.surfaceRaised}"
    textColor: "{colors.signal}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 8px
  status-failed:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.background}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 8px
  status-verified:
    backgroundColor: "{colors.success}"
    textColor: "{colors.background}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 8px
---

## Overview

Collision Canary is an Agentic DevTool with the posture of a precise debugging instrument. The interface makes two independent browser actors and their shared state legible at a glance. It uses canary yellow as a controlled signal, red only for proven collision, and green only for a complete verified invariant.

The emotional hook is simple: two green journeys can still leave one broken system.

### Brand core

- Name: Collision Canary
- Tagline: Catch the bug only two users can make.
- One-line position: Synchronized browser actors expose shared-state failures and keep the coding agent working until the invariant holds.
- Audience: AI-native product engineers, SDETs, engineering leads, and hackathon judges.
- Personality: vigilant, exact, calm, technical, and honest about proof limits.

### Logo direction

Use a split-path mark. Two rails approach one shared state and a sharp canary-beak shape interrupts the collision. The repaired state shows one rail continuing while the second stops cleanly. The geometry must remain readable at 16px.

Do not use a generic `CC` monogram, robot face, neural-network nodes, shield, checkmark badge, or sponsor logo reconstruction.

### Mascot direction

The mascot is a compact mechanical canary sentinel with one diagnostic eye and a tail formed from two diverging rails. It is restrained and appears only in favicon, loading, empty, and pitch-transition contexts. It does not appear as a large friendly hero character.

States:

- Watching
- Collision detected
- Repair running
- Invariant verified

## Colors

- Background `#090B0F`: near-black operating surface.
- Surface `#11151B`: primary diagnostic panels.
- Raised surface `#171C23`: selected rows, controls, and proof objects.
- Border `#29323D`: crisp separation without glow.
- Signal `#F6D84A`: canary warning and primary action.
- Danger `#FF5D62`: confirmed invariant violation only.
- Success `#45D39A`: complete verified invariant only.
- Text `#F3F5F7`: primary copy.
- Muted text `#8C97A5`: metadata and secondary explanation.
- Focus `#FFF1A6`: visible keyboard focus and primary hover.

No gradients. No glass blur. No pulsing green status dots. Status must use text, rails, stamps, or rows.

## Typography

Use Geist for product copy and Geist Mono for evidence IDs, actor names, timestamps, invariant keys, reason codes, terminal excerpts, and numeric state.

Rules:

- Headings are compact and left aligned.
- Body copy stays under 70 characters per line on marketing surfaces.
- Uppercase mono labels use short operational language.
- Mono is an accent, never the body font.
- Proof numbers use tabular numerals.
- The word `verified` appears only for a complete terminal result.

## Layout

### Grid

- Marketing pages: 12 columns, maximum width 1200px.
- Product pages: 12 columns, maximum width 1440px.
- Main product shell: 240px navigation rail plus flexible workspace on desktop.
- Standard panel gap: 16px.
- Section spacing: 96px desktop, 64px tablet, 48px mobile.
- Primary proof content remains above the fold at 1440 by 900.

### Density

The product is compact and diagnostic. Use rows, timelines, and state tables before generic feature cards. Marketing sections may breathe, but the proof view should prioritize scanning speed.

### Responsive behavior

- Below 960px, navigation becomes a compact top bar.
- Actor panels stack vertically while retaining shared timeline order.
- The invariant and terminal verdict remain before verbose evidence.
- Tables become labeled key-value stacks.
- Every primary control remains at least 44px high.

## Elevation & Depth

Depth comes from surface changes and border contrast. Avoid large soft shadows.

- Base panels use `surface` with one-pixel border.
- Selected or active panels use `surfaceRaised`.
- Modal or command surfaces may use a tight shadow with low blur and 35 percent black opacity.
- Error and success states change border and label color without tinting the full page.

## Shapes

- Small controls: 4px radius.
- Buttons and inputs: 8px radius.
- Major panels: 12px radius.
- Actor rails use square or lightly rounded endpoints.
- Pills are limited to compact status labels.
- Avoid oversized rounded rectangles.

## Components

### Product shell

- Wordmark and current environment.
- Navigation: New Run, Runs, Lab, System.
- Persistent deadline text is excluded from the product UI.
- Kane connection status uses a labeled row, not a dot.

### Invariant composer

- Scenario selector.
- Read-only invariant statement for V1.
- Actor count and shared resource summary.
- Primary action: `Start paired run`.
- Secondary action: `Inspect latest proof`.

### Actor card

- Actor name and stable key.
- Browser status.
- Barrier status.
- Visible user outcome.
- Request and completion timestamps.
- Kane terminal summary link when available.

### Shared execution rail

- Two horizontal rails enter one shared resource lane.
- Before release: both rails stop at the barrier.
- Failed state: both rails continue into one capacity slot and the collision node turns red.
- Verified state: one rail continues and one stops with the label `seat unavailable`.
- Motion is optional and respects reduced motion.

### Verdict panel

- Invariant statement.
- Terminal label: `VIOLATED`, `VERIFIED`, or `INFRASTRUCTURE ERROR`.
- Actor-success count.
- Persisted-claim count.
- Final remaining capacity.
- Stable reason code.
- Scope sentence explaining what was observed.

### Repair packet panel

- Failed acceptance criterion.
- Relevant backend boundary.
- Redaction status.
- Packet hash.
- Action: `Copy local repair command`.
- The public UI never exposes an action that executes Codex.

### Buttons

- Primary actions use canary yellow with dark text.
- Secondary actions use raised surface and white text.
- Destructive actions are absent from the public V1.
- Disabled controls explain why they are unavailable.

### Form fields

- Labels remain visible above inputs.
- Focus uses the pale-yellow focus token.
- Error copy names the corrective action.
- No placeholder-only labels.

### Status language

Use:

- Preparing actors
- Waiting at barrier
- Actors released
- Evaluating invariant
- Collision detected
- Repair packet ready
- Invariant verified
- Infrastructure error

Avoid:

- Magic
- Smart
- Autonomous success
- Demo mode
- Mock result
- AI-powered insight

### Screen wireframe: landing `/`

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Collision Canary                                      View proof    │
├──────────────────────────────────────────────────────────────────────┤
│ EYEBROW: MULTI-ACTOR INVARIANT VERIFICATION                          │
│                                                                      │
│ Two users. One state.                                                │
│ Find what breaks.                                                    │
│                                                                      │
│ Synchronized Kane browser journeys expose shared-state failures      │
│ and keep the coding agent working until the invariant holds.         │
│                                                                      │
│ [Run the last-seat test]  [Inspect a proof run]                      │
│                                                                      │
│ ALICE ─────────────┐        FINAL SEAT                               │
│                    ├──────> [ 1 remaining ]                          │
│ BOB   ─────────────┘                                                  │
├──────────────────────────────────────────────────────────────────────┤
│ Sequentially green                         Shared-state violation     │
│ Alice can claim. Bob can claim.             Both cannot claim one.    │
├──────────────────────────────────────────────────────────────────────┤
│ 1. Arm actors  2. Release together  3. Evaluate  4. Repair and rerun │
├──────────────────────────────────────────────────────────────────────┤
│ Real Kane browsers | Neon shared state | Codex repair packet         │
└──────────────────────────────────────────────────────────────────────┘
```

Exact hero copy:

- Eyebrow: `MULTI-ACTOR INVARIANT VERIFICATION`
- Headline: `Two users. One state. Find what breaks.`
- Primary action: `Run the last-seat test`
- Secondary action: `Inspect a proof run`

### Screen wireframe: run creation `/run`

```text
┌───────────────┬──────────────────────────────────────────────────────┐
│ New Run       │ NEW PAIRED RUN                                      │
│ Runs          │                                                      │
│ Lab           │ Scenario                                            │
│ System        │ [Last-seat booking                         v]        │
│               │                                                      │
│               │ Invariant                                           │
│               │ At most one actor can claim the final seat.          │
│               │                                                      │
│               │ Actors        Alice, Bob                             │
│               │ Capacity      1                                      │
│               │ Isolation     New resource per run                   │
│               │                                                      │
│               │ [Start paired run]                                   │
└───────────────┴──────────────────────────────────────────────────────┘
```

Empty state: no previous runs shows `No proof runs yet. Start with the last-seat invariant.`

Error state: run creation failure shows a request ID and `The run was not created. Retry after the database connection is restored.`

### Screen wireframe: actor lab `/lab/last-seat`

```text
┌──────────────────────────────────────────────────────────────────────┐
│ LAST-SEAT BOOKING                       Actor: Alice                 │
├──────────────────────────────────────────────────────────────────────┤
│ Final seat                                                           │
│ Capacity 1                         Remaining 1                        │
│                                                                      │
│ Alice and another browser actor will attempt this shared action.     │
│                                                                      │
│ [Arm claim]                                                          │
│                                                                      │
│ STATUS: WAITING FOR BOB                                               │
│ Barrier arrivals 1 of 2                                               │
└──────────────────────────────────────────────────────────────────────┘
```

Terminal success: `Alice claimed the final seat.`

Terminal rejection: `The final seat was already claimed.`

Infrastructure error: `The claim could not be verified. Run status remains incomplete.`

### Screen wireframe: live proof `/runs/[runId]`

```text
┌───────────────┬──────────────────────────────────────────────────────┐
│ New Run       │ PROOF RUN run_7F2A                    [VIOLATED]     │
│ Runs          │ At most one actor can claim the final seat.          │
│ Lab           ├──────────────────────────────────────────────────────┤
│ System        │ ALICE ─── armed ─── released ─── SUCCESS             │
│               │ BOB   ─── armed ─── released ─── SUCCESS             │
│               │                         ╲     ╱                       │
│               │                         COLLISION                     │
│               ├──────────────────────────────────────────────────────┤
│               │ Actor successes       2                              │
│               │ Persisted claims      2                              │
│               │ Final remaining       0                              │
│               │ Reason                non_linearizable_outcome       │
│               ├──────────────────────────────────────────────────────┤
│               │ Repair packet ready                                  │
│               │ Redaction passed | Packet sha256: 64d2...            │
│               │ [Copy local repair command]                           │
└───────────────┴──────────────────────────────────────────────────────┘
```

Verified rerun replaces the collision node with one continued rail and one stopped rail. The page states `One successful claim. One correct rejection. Shared state is consistent.`

### Screen wireframe: proof comparison

```text
┌─────────────────────────────┬────────────────────────────────────────┐
│ BEFORE REPAIR               │ AFTER REPAIR                           │
│ VIOLATED                    │ VERIFIED                               │
│ Alice success               │ Alice success                          │
│ Bob success                 │ Bob rejected                           │
│ 2 persisted claims          │ 1 persisted claim                      │
│ non_linearizable_outcome    │ capacity_invariant_satisfied           │
└─────────────────────────────┴────────────────────────────────────────┘
```

### Mobile-critical behavior

- Show invariant and terminal verdict first.
- Stack Alice, shared resource, and Bob in execution order.
- Keep the primary action sticky only while the run is non-terminal.
- Collapse raw evidence behind `Technical evidence`.
- Never horizontally scroll the core verdict.

### Empty, loading, and error states

- Empty: mechanical canary sentinel watching two idle rails.
- Loading: static rails with changing text labels. No infinite decorative loop.
- Product failure: red collision stamp plus exact observed counts.
- Infrastructure error: neutral border, yellow label, request ID, and retry action.
- Verified: green stamp, exact counts, and linked before-run when available.

## Do's and Don'ts

### Do

- Lead with the invariant and actor outcomes.
- Keep the paired execution rail consistent across landing, product, and pitch.
- Use real run IDs, timestamps, and counts.
- Use canary yellow sparingly for attention and action.
- Distinguish violation, rejection, and infrastructure error.
- Respect reduced motion and keyboard focus.
- Preserve exact copy and labels in implementation.

### Don't

- Add gradients, glass panels, glowing borders, or floating blobs.
- Fill the product with generic cards and icons.
- Use fake usage metrics, customers, testimonials, or activity.
- Use green before the entire invariant is verified.
- Put Codex execution behind a public button.
- Present incomplete evidence as a product failure.
- Use sponsor marks as unofficial seals.
- Use a warm cartoon mascot as the primary visual.

## Asset manifest

| Asset | Path | Status |
|---|---|---|
| Primary dark mark | `assets/brand/collision-canary-mark-dark.png` | Generate before scaffold |
| Horizontal lockup | `assets/brand/collision-canary-lockup-dark.png` | Generate before scaffold |
| Mechanical sentinel | `assets/brand/collision-canary-sentinel.png` | Generate before scaffold |
| Architecture diagram | `assets/diagrams/architecture.png` | Render from canonical HTML |

Generated brand assets remain local until MystiqueMide explicitly approves repository inclusion or publication.

## Build rules

1. Implement one product surface at a time.
2. Preserve approved copy, tokens, and state language.
3. Use real backend records as soon as the backend exists.
4. Verify every route after implementation.
5. Keep provider, database, and invariant logic outside visual components.
6. Build backend and orchestration before landing-page polish.
7. Remove all starter-template copy before review.
