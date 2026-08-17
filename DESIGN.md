# Design System

## Direction

**Scene:** A team leader opens Nong Fah during a bright client workshop, projecting the interface on a meeting-room screen while advisors follow along on laptops; the product feels composed, legible, and candid about what the AI knows.

**Register:** Product UI  
**Color strategy:** Restrained  
**Mood:** Codex-like work tool restraint with one confident blue accent

## Color Palette

All implementation colors use OKLCH semantic tokens.

```css
:root {
  --background: oklch(0.995 0 0);
  --surface: oklch(0.975 0 0);
  --surface-strong: oklch(0.935 0 0);
  --foreground: oklch(0.20 0.01 255);
  --muted-foreground: oklch(0.46 0.01 255);
  --border: oklch(0.89 0 0);

  --primary: oklch(0.55 0.17 255);
  --primary-hover: oklch(0.50 0.16 255);
  --primary-foreground: oklch(1 0 0);
  --primary-soft: oklch(0.955 0.012 255);

  --accent: oklch(0.935 0 0);
  --accent-strong: oklch(0.55 0.17 255);
  --accent-foreground: oklch(0.23 0.01 255);

  --success: oklch(0.44 0.12 150);
  --success-soft: oklch(0.95 0.035 150);
  --warning: oklch(0.62 0.14 75);
  --warning-soft: oklch(0.96 0.04 75);
  --danger: oklch(0.52 0.18 28);
  --danger-soft: oklch(0.95 0.035 28);
  --focus: oklch(0.55 0.17 255);
}
```

Most surfaces and selected states stay neutral. Blue is reserved for primary actions, focus, active icons, evidence context, and the Nong Fah identity mark. Status never relies on color alone.

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

- Desktop shell: 224px sidebar, fluid main content, optional 320–360px context panel.
- Chat content maximum width: 760px.
- Knowledge list maximum width: 1180px.
- Primary page padding: 24–32px desktop, 16px mobile.
- Spacing rhythm: 4, 8, 12, 16, 24, 32, 48.
- Sidebar collapses below 768px into a sheet opened from the top bar.
- Avoid nesting bordered cards. Use surface changes, dividers, and whitespace to express hierarchy.

## Shape and Elevation

- Controls: 10px radius.
- Panels/cards: 12–14px radius maximum.
- Pills only for compact status and tags.
- Prefer a border or a compact shadow, never both as decoration.
- Main composer uses a defined border and focus ring rather than decorative elevation.

## Core Components

### App shell

Quiet blue-neutral sidebar, soft current-location state, project identity, and provider/model context. Navigation labels are Thai-first and paired with restrained Lucide work-tool icons. Role switching belongs to separate product endpoints, not the primary shell.

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
- Keep fixture/reset controls in a low-emphasis workspace utility area; do not label primary product surfaces as Prototype/Demo.

## Accessibility

- WCAG 2.2 AA contrast and interaction baseline.
- 44px minimum touch targets.
- Visible focus ring using `--focus`.
- Semantic buttons, links, forms, tables, navigation, and status regions.
- Side sheets trap focus and restore it to the trigger.
- Loading and save outcomes use polite live regions; errors use alerts.
- Keyboard users can complete chat, knowledge creation, approval, and gap conversion flows.
