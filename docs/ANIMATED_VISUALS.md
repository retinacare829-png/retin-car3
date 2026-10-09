# Animated clinical visuals

These are application adaptations of [Rare UI](https://rareui.com), Copyright (c)
2026 Swami Malode, under [MIT + Commons Clause + Attribution](RARE_UI_LICENSE.txt).
The original [license](https://github.com/swamimalode07/rare-ui/blob/main/LICENSE)
was checked on 2026-10-09. Retain the source notices, license, and README credit.

No runtime dependencies were added. Each component exports its named component and
`…Props` interface from `src/components/<name>.tsx` and imports its own CSS.
Colors inherit live `--rc-*` clinic variables; no canvas color snapshot is cached.

## AnimatedFolder

[Reference](https://www.rareui.com/components/foldercomponent): fanned document
cards and a perspective folder flap. The adaptation uses CSS transitions instead
of Motion springs. Hover, keyboard focus, selected files, and file drag activate
the visual; the native button opens the file picker, including on touch devices.
Reduced motion removes transitions and the card/flap transformations.

Required props: `inputLabel: string`, `onFiles: (files: File[]) => void`.
Optional props: `label`, `buttonLabel`, `description`, `describedBy` (hint/error IDs),
`invalid`, `accept`, `multiple`, `disabled`, `busy`, `selected`, `size: "sm" | "md" |
"lg"`, `compact`, `className`, `style`.

Both picker and drop dispatch the first file by default, or all files with
`multiple`. Empty/cancelled selection does nothing. The input resets so the same
file can be retried. `accept` is a picker hint; rejected types are deliberately
passed to the caller's existing validator. `disabled` or `busy` blocks both paths.
Validation, async error handling, upload, deletion, and persistence stay with the
caller. Override `--folder-color`, `--folder-dark`, or `--folder-paper` via CSS if
needed; their defaults follow the clinic theme.

Integrated in `ClinicSettings.tsx`: existing logo validation, palette extraction,
preview cleanup, and save/register handlers are preserved.

`ImageCaptureControl` is defined inside parent-owned `ScreeningManagement.tsx`.
The parent can replace its file label with the following, retaining the existing
`handleFileSelection`, hint, error, and delete control:

```tsx
import { AnimatedFolder } from "./AnimatedFolder";

<AnimatedFolder
  compact size="sm"
  inputLabel={`Cargar imagen ${laterality}`}
  label={image ? image.originalFileName : "Arrastrá una imagen retinal"}
  buttonLabel={uploading ? "Cargando…" : image ? "Reemplazar" : "Cargar"}
  describedBy={uploadError ? `${hintId} ${errorId}` : hintId}
  invalid={Boolean(uploadError)}
  disabled={!canUpload || saving}
  busy={uploading}
  selected={Boolean(image)}
  onFiles={(files) => { if (files[0]) void handleFileSelection(files[0]); }}
/>
```

The parent should place the folder in the capture row's second grid column, e.g.
`.image-capture-row > .animated-folder { grid-column: 2; }`, or in its desired
full-width upload region. This subtask does not modify that parent's layout.

## MatrixThinkingOrb

[Reference](https://www.rareui.com/components/matrixorb): circular dot matrix with
three orbiting areas of emphasis. This adaptation uses a static SVG dot mask and
three CSS-rotated radial gradients: dot brightness changes instead of recalculating
dot radii in a canvas on every frame. There are no JavaScript animation loops,
listening/idle states, audio input, demo controls, or simulated progress.

Props: `active?: boolean` (default true; false renders nothing), `label?: string`
(default `Analizando imagen…`), `announce?: boolean` (default true), `size?: number`
(48–320 px, default 112), `className?`, `style?`. Override `--orb-color` if needed.
The animation pauses offscreen and in hidden tabs; reduced motion renders a static
matrix and retains its status text. Observers/listeners are cleaned up on unmount
or when inactive. Unique SVG IDs allow multiple instances.

For parent-owned `RetinalAnalysisPanel.tsx`:

```tsx
import { MatrixThinkingOrb } from "./MatrixThinkingOrb";
<MatrixThinkingOrb active={analyzing} label="Analizando imagen…" announce={false} />
```

Use `announce={false}` if the parent already announces its operation. This
component does not run inference, estimate completion, or announce results.

## AnimatedNotificationBell

[Reference](https://www.rareui.com/components/notificationbell): bell/clapper swing
and rolling unread badge. This adaptation uses a finite 900 ms CSS swing when the
normalized count increases, a finite 240 ms number entrance, and badge scale/opacity
transitions. Increments up to five increase the swing amplitude. It does not retain
spring momentum or implement the upstream per-digit odometer/Radix `asChild` API.

Props: native button attributes (including `onClick`, `disabled`, `aria-expanded`,
`aria-controls`, `aria-haspopup`), forwarded button ref, `count?: number` (default
0), `max?: number` (default 99), `variant?: "count" | "dot"`, `size?: number`
(44–96 px, default 44), `label?: string` (default `Notificaciones`), and
`announce?: boolean` (default true), and `decorative?: boolean` (default false).
`aria-label` overrides the generated label.
Negative/nonfinite counts become zero, fractions are floored, and the accessible
label retains the full count even when the visual badge shows `99+` or a dot.
Override `--bell-badge-color` and `--bell-badge-text` together if needed for contrast.

For parent-owned `ClinicWorkspace.tsx`:

```tsx
import { AnimatedNotificationBell } from "./AnimatedNotificationBell";
<AnimatedNotificationBell
  count={unreadCount}
  onClick={openNotifications}
  aria-expanded={notificationsOpen}
  aria-controls="clinic-notifications"
/>
```

Supply real unread state and existing navigation/popover actions. The component
does not fetch, persist, mark read, or invent notifications. First mount and
decreases do not ring. Reduced motion and disabled state suppress animations.

When `NotificationCenter` already owns the accessible button and live count, its
`renderBell` slot can use `renderBell={({ count }) => <AnimatedNotificationBell
decorative count={count ?? 0} />}`. `decorative` renders an `aria-hidden` span with
no button, status, ref, or event handlers; the parent's trigger owns those. This
avoids nested buttons and duplicate screen-reader announcements.
