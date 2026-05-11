# NoteBender Design Improvement Plan

Reviewed on 2026-05-11.

This plan is scoped to improving the existing NoteBender app. It does not propose new product features. The goal is to make the current harmonica visualizer, MusicXML tab viewer, note highway, practice trainer, and circle theory view feel more coherent, responsive, accessible, and polished.

## Product Design Direction

NoteBender should feel like a focused practice instrument: compact, musical, fast to scan, and comfortable during repeated use. The current dark interface is a good foundation, but each route currently solves layout, controls, colors, and feedback slightly differently. The main improvement is to create a shared design language and then apply it to each existing workflow.

Recommended principles:

- Keep the app tool-like, not marketing-like.
- Keep controls visible, compact, and predictable.
- Use color to communicate musical state, not decoration.
- Preserve the current route model and existing behavior.
- Prioritize mobile stability because several views have dense grids or canvases.
- Use icons only for recognizable actions such as play, pause, restart, upload, download, microphone, settings, and tempo.

## Current UX Findings

- Navigation has no active route state, so users cannot immediately see where they are.
- Route headings use different visual styles and some emoji labels, which makes the app feel less consistent.
- Controls are repeated with slightly different spacing, colors, borders, and disabled states across routes.
- The notation switch is visually wrapped by the menu instead of being a self-contained control.
- Several route panels use similar dark cards, but border color, radius, padding, and hierarchy are inconsistent.
- The harmonica and practice grids are functional, but row meaning depends heavily on color without enough labeling or layout hierarchy.
- MusicXML is the most powerful screen, but its sidebar, sheet, status, downloads, and note highway compete for attention.
- The note highway has useful state, but the stats and current-tab feedback could be visually grouped more clearly.
- Circle theory is interactive, but its selected state, legend, and output panels could be easier to scan.
- Accessibility is partially present, but focus states, active states, hidden file input behavior, and color-only state need a dedicated pass.

## Phase 1: Create Shared UI Foundations

Create a small set of shared visual conventions before changing individual routes.

Implementation steps:

1. Define app-level class patterns for surfaces, controls, buttons, icon buttons, fields, status messages, chips, and focus rings.
2. Use a restrained dark palette with neutral surfaces, one primary action color, one success color, one warning color, and one error color.
3. Standardize border radius at `rounded` or `rounded-lg` only where the current UI needs a framed panel.
4. Standardize spacing: page padding, panel padding, grid gaps, label spacing, and route max widths.
5. Standardize typography: route title, section title, control label, helper text, metric text, and large musical readouts.
6. Replace route title emoji with consistent icon usage where helpful, using `lucide-react` for action icons.
7. Add consistent focus-visible rings for links, buttons, selects, inputs, and range controls.

Acceptance checks:

- Buttons with the same importance look the same across all routes.
- Disabled controls are visibly disabled and do not rely only on opacity.
- Every interactive element has a visible keyboard focus state.
- The interface no longer reads as four separate visual systems.

## Phase 2: Improve App Shell And Navigation

The shell should orient users quickly without taking space away from practice workflows.

Implementation steps:

1. Add an app identity area in `src/Menu.tsx` with the NoteBender name and a compact musical mark.
2. Use `NavLink` instead of `Link` so active route styling is automatic.
3. Keep the current four routes, but make active state obvious with an underline, filled pill, or high-contrast text.
4. Convert the notation switch into a proper segmented/toggle-style button instead of wrapping it in a cyan container.
5. Move external links into a visually secondary group so they do not compete with primary app navigation.
6. Make the mobile nav a stable two-row layout or horizontally scrollable row with no wrapping jumps.
7. Keep `HashRouter` and the default `/harmonica` route unchanged.

Acceptance checks:

- Users can identify the current route without reading page content.
- The menu does not cause horizontal overflow at 320px width.
- External links are still accessible and clearly secondary.

## Phase 3: Normalize Route Page Structure

All routes should share a predictable page rhythm.

Implementation steps:

1. Give each route a consistent page shell: title area, optional current-state summary, control area, primary workspace.
2. Avoid vertically centering dense tools. Use top-aligned layouts so controls and content do not jump between routes.
3. Use consistent max widths:
   - Narrow tool views: `max-w-3xl` or `max-w-4xl`.
   - Dense workspaces: `max-w-6xl` or full-width constrained layouts.
4. Make panels visually quiet: dark surface, subtle border, restrained shadow, consistent padding.
5. Remove unnecessary nested card styling where a simple panel section is enough.
6. Keep all route roots compatible with the existing `min-h-dvh` app shell.

Acceptance checks:

- Route transitions feel coherent.
- Titles, control labels, and panels align consistently.
- No route looks like an isolated prototype.

## Phase 4: Improve Harmonica Visualizer

The harmonica route should make pitch, tuning, and hole layout immediately readable.

Implementation steps:

1. Reframe the page as a tuner plus harmonica map instead of a centered title-and-grid page.
2. Make the microphone action the primary control and show listening/error/idle states in one consistent status area.
3. Replace raw `Pitch: 440 Hz` style output with a stronger detected-note readout and secondary frequency/clarity details.
4. Add a compact tuning meter using the existing cents value so sharp/flat/center states are easier to read.
5. Add visible row labels beside the harmonica grid, especially for bends and overblows.
6. Strengthen the detected note state with a clear cell highlight, not only the thin green line.
7. Keep the 10-hole grid horizontally scrollable on small screens, but make the scroll container feel intentional.
8. Keep the key selector near the grid and use the same select styling as other routes.

Acceptance checks:

- A player can see the detected note, tuning direction, and matching hole at a glance.
- The grid remains usable at 320px width.
- Bend and overblow rows are understandable without relying only on color.

## Phase 5: Improve Practice Trainer

The practice route should feel like a focused exercise console.

Implementation steps:

1. Convert trainer modes into a segmented control with clear active state.
2. Keep key, position, scale, and mode controls in a compact control bar or responsive panel.
3. Make the active target card the visual anchor in practice and bends modes.
4. Use the same listening status pattern as the harmonica route.
5. Make hit/waiting state larger and easier to read, while preserving the current hit logic.
6. Add row labels to the harmonica grid or a compact legend so the meaning of colors is clear.
7. Keep inactive notes visible but reduce their visual noise with a consistent muted style.
8. In 12-bar mode, make the current bar stand out and keep the chord-tone highlight consistent with the grid.

Acceptance checks:

- Users can change exercise context without hunting through the interface.
- The current target is unambiguous.
- Explore, Practice, Bends, and 12-bar modes feel like variants of one trainer, not separate screens.

## Phase 6: Improve MusicXML Workspace

The MusicXML route needs the most hierarchy work. It should guide users from loading a score to playing and practicing it without overwhelming them.

Implementation steps:

1. Rename the route component from `TestFileLoader` to a production name during a UI refactor.
2. Reorganize the screen into three clear regions:
   - Score setup: file, key, transpose, auto-transpose filters, downloads.
   - Score viewer: OSMD sheet.
   - Practice playback: note highway and playback controls.
3. Move the route status message close to the setup controls and keep it visually distinct from the score.
4. Make upload, auto transpose, and downloads use consistent button hierarchy:
   - Primary: upload or play, depending on context.
   - Secondary: auto transpose and downloads.
   - Disabled: clear reason through nearby status or button state.
5. Replace emoji button labels with lucide icons plus concise text.
6. Make transpose input more intentional with a numeric stepper style and clear semitone label.
7. Group the no-overblow/no-bend filters as real checkboxes with a shared label and consistent accent color.
8. Keep the sheet viewer visually separate by using a white document surface with a subtle dark frame.
9. On mobile, stack setup, highway, and score in the order that supports action: setup, playback controls, sheet.
10. Preserve existing MusicXML parsing, OSMD rendering, playback, and download behavior.

Acceptance checks:

- Users can tell what to do first when the page loads.
- The score viewer and note highway no longer compete equally with setup controls.
- Disabled playback/download states are clear before the score is ready.

## Phase 7: Polish Note Highway

The note highway is the app's most game-like interaction, so it should feel responsive and readable.

Implementation steps:

1. Group play, restart, tempo, current tab, and progress into one playback control strip.
2. Make play/pause the clear primary action.
3. Keep restart as an icon button with an accessible label and tooltip/title.
4. Reduce visual weight of stats chips and group them as performance metrics.
5. Make the target zone more legible without overpowering note tiles.
6. Keep lane labels visible and stable, especially when lane count changes.
7. Improve bottom microphone status so pitch, cents, clarity, and mic errors follow the same status pattern used elsewhere.
8. Add a `prefers-reduced-motion` CSS path for any animated or pulsing states.

Acceptance checks:

- The current note, upcoming notes, and target line are readable during playback.
- Stats support practice without distracting from timing.
- The component remains stable across mobile, tablet, and desktop widths.

## Phase 8: Improve Circle Theory View

The circle route should read as a musical theory instrument, not just a graphic and a legend.

Implementation steps:

1. Keep the circle as the primary visual but add a stronger selected-state summary near it.
2. Make root, mode, and scale controls visually consistent with the rest of the app.
3. Preserve horizontal scrolling controls on small screens, but improve spacing and active states.
4. Use one consistent color language for scale notes, major triads, minor triads, diminished triads, unclassified notes, and tonic.
5. Reduce legend dominance by making it compact and scannable.
6. Improve triad rows with clearer columns and consistent badges.
7. Ensure circle button text fits in every supported notation mode.
8. Check that all touch targets remain at least 40px on small viewports.

Acceptance checks:

- Users can identify tonic, scale membership, and triad quality quickly.
- The legend explains the color system without taking attention from the circle.
- The circle remains centered and usable on narrow screens.

## Phase 9: Accessibility And Responsiveness Pass

This pass should happen after the main visual structure changes.

Implementation steps:

1. Audit color contrast for dark panels, muted text, colored cells, and disabled states.
2. Add visible `focus-visible` states everywhere.
3. Ensure icon-only buttons have `aria-label` and `title` where appropriate.
4. Use `aria-pressed` for toggle buttons and segmented controls.
5. Ensure status messages use `role="status"` or `role="alert"` consistently.
6. Avoid color-only meaning in harmonica rows, practice targets, note highway hits, and circle chord quality.
7. Verify hidden file input behavior remains keyboard-accessible.
8. Test at 320px, 390px, 768px, 1024px, and desktop widths.
9. Check that no text overflows buttons, cells, route headers, chips, or cards.

Acceptance checks:

- Full keyboard navigation works through the menu and each route's controls.
- Screen-reader labels are meaningful for upload, playback, restart, microphone, and route navigation.
- No route creates horizontal body overflow except intentional grid scroll containers.

## Suggested Implementation Order

1. Shared UI foundations and focus styles.
2. App shell navigation and notation switch.
3. Route page structure normalization.
4. Harmonica and Practice visual refresh, since they share layout and pitch feedback patterns.
5. MusicXML setup panel and note highway polish.
6. Circle theory polish.
7. Accessibility and responsive QA pass.

## Definition Of Done

- No new product features are introduced.
- Existing route behavior is preserved.
- `npm run lint` passes after React component changes.
- `npm run build` passes after UI changes.
- `npm test` passes when shared helpers or MusicXML logic are touched.
- Manual viewport checks cover 320px, 390px, 768px, and desktop.
- Microphone and Web Audio flows are manually smoke-tested after Harmonica, Practice, or MusicXML playback changes.
- MusicXML rendering is manually smoke-tested with the bundled `IntroSong.musicxml`.
