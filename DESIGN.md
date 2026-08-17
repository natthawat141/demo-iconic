# Design System

## Direction

**Scene:** A team leader opens Nong Fah during a bright client workshop, projecting the interface on a meeting-room screen while advisors follow along on laptops; the product feels composed, legible, and candid about what the AI knows.

**Register:** Product UI  
**Color strategy:** Restrained  
**Mood:** Grounded expertise with one confident, human accent

## Color Palette

All implementation colors use OKLCH semantic tokens.

```css
:root {
  --background: oklch(1 0 0);
  --surface: oklch(0.975 0 0);
  --surface-strong: oklch(0.94 0.006 24);
  --foreground: oklch(0.19 0.015 24);
  --muted-foreground: oklch(0.45 0.012 24);
  --border: oklch(0.89 0.006 24);

  --primary: oklch(0.55 0.18 24);
  --primary-hover: oklch(0.49 0.17 24);
  --primary-foreground: oklch(1 0 0);
  --primary-soft: oklch(0.95 0.025 24);

  --accent: oklch(0.89 0.055 225);
  --accent-strong: oklch(0.43 0.11 235);
  --accent-foreground: oklch(0.22 0.035 235);

  --success: oklch(0.44 0.12 150);
  --success-soft: oklch(0.95 0.035 150);
  --warning: oklch(0.62 0.14 75);
  --warning-soft: oklch(0.96 0.04 75);
  --danger: oklch(0.52 0.18 28);
  --danger-soft: oklch(0.95 0.035 28);
  --focus: oklch(0.53 0.14 235);
}
```

Primary is reserved for the main action, selected navigation, and the Nong Fah identity mark. Blue is an informational counterpoint for evidence, citations, and knowledge context. Status never relies on color alone.

## Typography

- Family: Noto Sans Thai for Thai and Latin UI text.
- Use one family across headings, labels, body, forms, and data.
- Page title: 1.5rem / 700 / -0.02em.
- Section title: 1.125rem / 650.
- Body: 0.9375rem / 1.65.
- Label: 0.8125rem / 600.
- Metadata: 0.75rem / 500.
- Long reading content is capped at 70ch.
- Headings use balanced wrapping; prose uses pretty wrapping.

## Layout

- Desktop shell: 248px sidebar, fluid main content, optional 320–360px context panel.
- Chat content maximum width: 760px.
- Knowledge list maximum width: 1180px.
- Primary page padding: 24–32px desktop, 16px mobile.
- Spacing rhythm: 4, 8, 12, 16, 24, 32, 48.
- Sidebar collapses below 900px into a sheet opened from the top bar.
- Avoid nesting bordered cards. Use surface changes, dividers, and whitespace to express hierarchy.

## Shape and Elevation

- Controls: 10px radius.
- Panels/cards: 12–14px radius maximum.
- Pills only for compact status and tags.
- Prefer a border or a compact shadow, never both as decoration.
- Main composer may use a short, tight elevation to separate it from the scrolling thread.

## Core Components

### App shell

Quiet surface sidebar, strong current-location state, project identity, role switcher, and Prototype badge. Navigation labels are Thai-first and paired with Lucide icons.

### Chat composer

Persistent, large enough for Thai text, with a visible label for assistive technology. Send is the only visually dominant control. Show precise loading, stopped, and error states.

### Assistant message

Assistant content reads like guidance, not a speech bubble. Evidence state appears before source cards. User messages may use a restrained tinted bubble for conversational orientation.

### Source card

Compact evidence row with document icon, source title, category, last update, and an explicit `เปิดแหล่งข้อมูล` action. Opening a source uses a side sheet rather than a centered modal.

### Knowledge list

Use a responsive data list/table on desktop and stacked rows on narrow screens. Status, owner, category, and last update are directly scannable. Search and filters remain visible.

### Knowledge editor

Single-column form with grouped metadata, sticky save/approval actions on desktop, persistent labels, inline errors, and a source-preview section. Approval is unavailable until required fields pass validation, with a visible reason.

### Knowledge gap row

Question text is primary. Occurrence count, last asked time, and status are secondary. `เพิ่มเป็น Knowledge` is the clear next action.

## Motion

- 150–220ms state transitions using ease-out-quart.
- Animate state changes, side-sheet entry, and lightweight save confirmation only.
- No staged page-load choreography or decorative floating effects.
- Reduced-motion mode removes transforms and uses immediate/crossfade state changes.

## Content Style

- Thai copy is concise, respectful, and operational.
- Prefer `ยังไม่มีข้อมูลเพียงพอ` over technical phrases such as retrieval failure.
- Avoid claiming certainty. Say what source was used and what happens next.
- Mark all fixtures and presenter controls as Prototype/Demo.

## Accessibility

- WCAG 2.2 AA contrast and interaction baseline.
- 44px minimum touch targets.
- Visible focus ring using `--focus`.
- Semantic buttons, links, forms, tables, navigation, and status regions.
- Side sheets trap focus and restore it to the trigger.
- Loading and save outcomes use polite live regions; errors use alerts.
- Keyboard users can complete chat, knowledge creation, approval, and gap conversion flows.
