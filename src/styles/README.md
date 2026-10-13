# Design system (DSP v4)

Source of truth: `DSP_v4_Redesign_Concept_2.pdf`. Values tagged `[INF]` in `tokens.css` were inferred from the PDF visuals, not printed in it.

| Layer | File | Use |
|---|---|---|
| Raw tokens | `src/styles/tokens.css` | CSS variables `--ds-*`. Edit values here only. |
| Tailwind bridge | `src/styles/theme.css` | Utilities: `bg-brand`, `text-ink-2`, `bg-danger-tint`, `rounded-card`, `shadow-card`, `font-mono` |
| Type scale | `src/styles/typography.css` | `.ds-display .ds-h1 .ds-question .ds-h2 .ds-body .ds-caption .ds-eyebrow .ds-mono .ds-code` |
| Fonts (offline) | `src/styles/fonts.css` | `@fontsource` imports: Plus Jakarta Sans, JetBrains Mono |
| Global base | `src/styles/base.css` | Page background, focus ring, reduced motion |
| PrimeNG theme | `src/app/core/theme/dsp-preset.ts` | Primary colour, radius, surfaces; wired in `app.config.ts` |
| Shared UI | `src/app/shared/ui/` | `DsStatusPill`, `DsPriorityBadge`, `DsSlaMeter`, `DsCallout`, `DsSidebar` |

## Rules for new screens
- Buttons, inputs, tabs, chips, toast, dialog: use PrimeNG (`p-button`, `pInputText`, `p-tabs`, `p-tag`, `p-toast`, `p-dialog`). Do not restyle them per page.
- Colours come from tokens/Tailwind utilities; never hard-code hex values.
- Minimum tap target 44px (`--ds-target-min`). State is never colour alone: pair it with a dot, icon or word.
- Project scope: light mode and English (LTR) only. No dark mode, no RTL/Arabic.

## Shared components
```html
<ds-status-pill tone="sre">With SRE</ds-status-pill>        <!-- neutral|info|success|warning|danger|sre -->
<ds-priority level="critical" [showSla]="true" />            <!-- critical|high|medium|low -->
<ds-sla-meter state="at-risk" label="1h 40m left" [progress]="75" />  <!-- ok|at-risk|breached|paused -->
<ds-callout tone="danger" icon="pi pi-times-circle" heading="Can't publish">step s5 can't be reached</ds-callout>
```

## Sidebar
```html
<ds-sidebar title="Digital Support" subtitle="Mobile & web banking" sectionLabel="Customer service"
            [items]="items" [activeId]="activeId()" [user]="user" (itemSelect)="go($event)" />
```
- `items: DsSidebarItem[]`: `{ id, label, icon: 'pi pi-home', badge?: { count, tone: 'open' | 'action' } }`. The parent supplies items per role; the component knows nothing about roles, routes or auth.
- Presentational: it emits `itemSelect`; the parent navigates and sets `activeId`.
- Rail is 264px; icons-only (84px) when `collapsed` is true (two-way: `[(collapsed)]`) and forced below 1180px.
- Layout contract: put it on the page background (`--ds-page`) with `--ds-rail-edge-gap` (16px) free on its right; the active tab extends into that gap and the content surface must be `--ds-rail-tab-bg`.
