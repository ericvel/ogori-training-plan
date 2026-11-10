---
name: "Ogori training plan"
description: "A calm, compact, light training log with restrained cobalt actions and factual run history."
colors:
  ink: "#243249"
  muted: "#606e80"
  line: "#e2e7ee"
  blue: "#2859bd"
  blue-light: "#edf2fc"
  green: "#27704c"
  green-light: "#edf7f0"
  canvas: "#f5f7fa"
  surface: "#fff"
  field-border: "#cbd3df"
  field-hover-border: "#8d9db4"
  field-disabled: "#f3f5f8"
  focus: "#86aaf2"
  button-border: "#cbd4e2"
  button-hover: "#f0f4fa"
  button-hover-border: "#9aaac0"
  blue-hover: "#204a9e"
  danger: "#ac3f30"
  note-surface: "#fbfcfe"
  note-border: "#e2e7ef"
  skipped: "#785b37"
  unsaved: "#805810"
  badge-text: "#536e57"
  badge-surface: "#eaf1e9"
  error-text: "#80382d"
  error-border: "#e7c3bb"
  error-surface: "#fff3ef"
  success-text: "#285c40"
  success-border: "#c1ddcb"
  success-surface: "#eff8f2"
  chart-muted: "#c8d3e7"
  progress-track: "#edf0f5"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "30px"
    fontWeight: 690
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  section:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.015em"
  session-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.55
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  button:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 550
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 600
  measurement:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "31px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
rounded:
  tag: "5px"
  field: "7px"
  control: "8px"
  message: "9px"
  surface: "12px"
  circle: "50%"
spacing:
  tight: "6px"
  small: "8px"
  control-gap: "9px"
  label-gap: "12px"
  compact-gap: "13px"
  list-gap: "15px"
  card-inset: "23px"
  column-gap: "26px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
    height: "44px"
  button-text:
    textColor: "{colors.blue}"
    typography: "{typography.button}"
    padding: "9px 2px"
    height: "44px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "9px 11px"
    height: "44px"
  navigation-active:
    backgroundColor: "{colors.blue-light}"
    textColor: "{colors.blue}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    height: "47px"
  week-badge:
    backgroundColor: "{colors.badge-surface}"
    textColor: "{colors.badge-text}"
    rounded: "{rounded.tag}"
    padding: "5px 8px"
  session-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "23px 23px 0"
  completion-checked:
    backgroundColor: "{colors.green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.circle}"
    size: "26px"
---

# Design System: Ogori training plan

## Overview

**Creative North Star: "The weekly training log"**

The weekly training log is calm, compact, and light. Cool white surfaces sit on a pale slate canvas, with ink navy text, restrained cobalt controls, and green completion marks. System sans typography and fine dividers make instructions and recorded measurements easy to scan.

Controls feel familiar and precise. Density comes from short labels, modest rounded corners, inline notes, and expandable details; important actions retain generous phone targets. The interface uses SVG line icons and no stock imagery or illustrative assets.

**Key Characteristics:**
- Cool white surfaces on a pale slate canvas.
- Restrained cobalt actions and green completion feedback.
- Compact system sans text with tabular measurements.
- Flat bordered containers, inline editing, and thumb-reachable mobile navigation.

## Colors

The palette is cool and neutral, with color reserved for task controls, selection, and factual status. The frontmatter records the source CSS values; names below describe their roles.

### Primary

- **Restrained Cobalt** (`blue`): primary actions, links, selected navigation, the selected chart bar, and progress fill. `blue-hover` deepens filled actions; `blue-light` supports selection and icon backgrounds.

### Secondary

- **Completion Green** (`green`): checked completion controls, completed labels and dates, linked evidence, and the connection indicator. `green-light` supports completed plan marks. `success-*` tokens belong to dismissible success feedback.
- **Quiet Sage** (`badge-text`, `badge-surface`): compact recovery, taper, and race-week context tags.
- **Brick** (`danger`, `error-*`): destructive confirmation and recoverable error messages. `skipped` is muted brown; `unsaved` is amber text beside the note label.

### Neutral

- **Ink Navy** (`ink`): headings, body text, and measurements.
- **Slate Text** (`muted`): supporting labels, units, dates, and explanations.
- **Pale Slate Canvas** (`canvas`) and **Cool White** (`surface`): page ground and working surfaces.
- **Fine Divider** (`line`): cards, rows, sidebar, footer structures, and expanded content boundaries.
- **Quiet Field** (`note-surface`, `note-border`): inline notes; general fields use `field-border`, strengthened by `field-hover-border` on hover.
- **Focus Blue** (`focus`): keyboard outline. `field-disabled` softens disabled inputs; `chart-muted` and `progress-track` support nonselected measurements.

**The Functional Color Rule.** Use cobalt for actions and selection; use green for completion and linked activity evidence. Keep text labels alongside status color.

## Typography

**Body and heading font:** the system sans stack recorded in the frontmatter. There is no separate display face, web font, or mono font. Headings use sentence case; measurements use tabular numerals.

### Hierarchy

- **Headline:** the page title uses `headline`; at widths up to 1000px it becomes (27px), retaining its weight, tracking, and line-height.
- **Section:** ordinary section headings use `section`. Week headings are (21px), become (20px) at 1180px, and (19px) at 760px.
- **Session title:** uses `session-title`, becoming (16px) on phones. Long titles wrap anywhere rather than overflow.
- **Body:** the root uses `body`; supporting content and workout instructions commonly use (13px), with paragraph/list line-height (1.6). Guidance is limited to (75ch), short scheduling notes to (65ch).
- **Label:** run labels use `label`. On phones, run labels, notes, dates, skip actions, and workout summaries end at (12px); status, linked counts, chart labels, and related supporting labels end at (11px) after the final mobile override.
- **Measurement:** the distance total uses `measurement`, becoming (28px) on phones. Countdown values use (27px) desktop and (23px) mobile. Units stay smaller and muted.
- **Inputs:** inline notes use (13px) desktop and (16px) mobile. The latter preserves native mobile input behavior.

**The Factual Measurement Rule.** Use tabular numerals for distances, counts, dates in activity rows, and pace values; keep units visually subordinate.

## Layout

The desktop shell has a fixed white navigation rail (228px) and a scrolling content area offset by the same width. Main padding is (42px 48px 24px) with a maximum width of (1510px). At 1700px and above, the main region centers with a maximum width of (1590px) and a (276px) left inset.

The weekly work area is a flexible session column plus a (276px) insights column with a (26px) gap. Sessions use a (15px) vertical gap and inset their body (39px) to align with title text beside the completion circle. Cards use the `card-inset` spacing token; insight panels use (21px). The scale is compact and empirical, rather than a strict multiple-of-four grid.

- **At 1180px and below:** rail and main offset become (200px), main padding becomes (35px 30px 24px), insights width becomes (240px), and the column gap becomes (19px). Card side padding is (19px); week badges are hidden.
- **At 1000px and below:** sessions and insights become one column; insights form two equal columns. The recovery note spans both. Activity pace and plan distance columns are hidden; expanded activity measurements use three columns. The race goal suffix is hidden.
- **At 760px and below:** the rail disappears. Main padding becomes (28px 21px 108px). Four fixed bottom navigation items occupy a white bar with safe-area padding. Sessions remain full width, with (13px) gaps, (19px 17px 0) card padding, and a (38px) body inset. Insights stay in two columns; expanded activity measurements use two columns. Chart value labels are hidden while chart labels remain visible.
- **At 380px and below:** main side padding becomes (16px), the header may wrap, insights become one column, the race icon and linked-count label are hidden, and progress counts return to a horizontal row.

The body supports a minimum width of (320px). Toolbars, labels, and action groups wrap where needed; data columns use `minmax(0, 1fr)` and long imported content wraps. Mobile navigation reserves bottom content clearance and uses `max(10px, env(safe-area-inset-bottom))` below its controls.

## Elevation & Depth

Surfaces are flat: no box shadows, overlays, blur, gradients, or hover lift. White panels on the slate page, thin borders, and restrained selected fills establish hierarchy. Expanded activity detail gets a subtly tinted background; expanded workout details get a top divider.

**The Flat Surface Rule.** Separate surfaces with tone and fine borders. Do not introduce shadows into this flat interface.

## Shapes

Use modest rounded rectangles: `surface` for cards and grouped lists, `control` for buttons and desktop navigation, `field` for inputs and icon buttons, `message` for feedback containers, and `tag` for week context tags. Completion controls, avatars, and plan session marks are circular. Ordinary borders are (1px); the completion outline is (1.5px). Charts have gently rounded bar tops (3px), and the thin progress track has (4px) corners.

Icons are inline SVG, normally (20px), with a (24 × 24) viewBox, no fill, `currentColor` strokes (1.7px), round caps, and round joins. Smaller contexts use (13–19px) icons; the brand icon is (23px). The SVG favicon and icon paths are the only shipping imagery.

## Components

### Buttons

Familiar, restrained controls. Filled primary buttons pair cobalt with white; secondary buttons pair white with ink and a fine blue-gray border; destructive confirmation uses brick and white. The shared button tokens record their type, padding, radius, and minimum height. The `height` frontmatter values describe source `min-height`, so labels may grow rather than clip.

Hover deepens primary buttons and softens secondary backgrounds. Text buttons are cobalt with underline on hover; the Skip variant is muted. General icon buttons are (44 × 44px); week arrows narrow to (33px) on phones while retaining (44px) height. Buttons disabled during pending operations use opacity (0.5) and a not-allowed cursor.

All keyboard controls use a visible (3px) focus outline with (3px) offset. Button background and border colors transition over (160ms), using the CSS default `ease`. There is no translated or scaled active state. Reduced-motion preference removes transitions and restores automatic scrolling.

### Chips

Week context badges are quiet sage, (10px) semibold, with the `week-badge` shape and inset. They are informational, not interactive filters. They disappear at the intermediate layout breakpoint. Plan marks instead use circular A/B/+ labels, green checked completion, or a neutral struck-through skipped state.

### Cards / Containers

Session cards, insight panels, activity lists, import previews, and empty states share white surfaces, fine dividers, and rounded corners. Preserve the compact insets documented in Layout; cards do not acquire hover shadows. Activity rows use larger clickable disclosure summaries, separated by borders.

### Inputs / Fields

General inputs and native selects use white backgrounds, `field-border`, `field` corners, and a minimum height of (44px). Hover strengthens the border. Disabled fields use the disabled fill and opacity (0.7); placeholders, where useful for search, are muted. Keyboard focus keeps the global outline.

Notes are single-line, full width, with quiet tinted fill and border. Their minimum height is (39px) desktop and (41px) mobile, and their background turns white on focus. They autosave after (600ms) of idle typing; the adjacent Notes label adds amber “Unsaved” while a draft remains. There is no repeated placeholder or separate save-status block.

### Navigation

Desktop navigation uses icon-and-label rows, a muted default state, a faint hover fill, and cobalt text on a pale selected fill. Rows are at least (47px) tall. The selected route has `aria-current="page"`. Mobile navigation uses four stacked icon/label buttons at least (65px) wide and (49px) tall, with a pale active tile and cobalt text. It is fixed at the bottom, respects the safe area, and stays separate from the scrolling content.

### Session completion and disclosure

A (26px) visible circle has an expanded transparent hit area via a (9px) inset around it. Pending is outlined, hover is pale cobalt, and completed is solid green with a white check. The toggle uses `aria-pressed`, a descriptive accessible label, and an adjacent Completed label; recorded dates appear below. Skipped sessions retain readable muted titles and a brown Skipped label.

Native details/summary reveals workout instructions, date input, and linked activity without navigation. Summaries have a minimum height of (47px). Opening rotates the SVG chevron (180deg) over (180ms); content is not animated. The interface also provides a keyboard skip-to-content link.

### Feedback

Errors and success confirmations use compact bordered, tinted message blocks with text and explicit actions; error content uses `role="alert"`, success uses `role="status"`. Note drafts stay visible on save failure and retry is offered. Loading uses static slate skeletons with a status label. Empty states use a restrained SVG icon, heading, explanation, and a useful action when available.

## Do's and Don'ts

### Do:
- Do preserve the compact light interface, restrained color, readable instructions, and large phone controls.
- Do keep Core run A/B and Optional labels, inline notes, autosave, and expandable workout details.
- Do preserve visible focus rings, semantic status text, and error recovery actions.
- Do use inline SVG line icons with round caps and joins.
- Do keep measurements aligned and use the existing responsive layout changes.

### Don't:
- Don't replace the pinned system sans interface with a decorative display typeface or imagery.
- Don't add repetitive note placeholders or a separate save-status section.
- Don't encode completed, skipped, unsaved, or error states through color alone.
- Don't add hover lift, card shadows, animated counters, or skeleton shimmer to the current flat, quiet system.
