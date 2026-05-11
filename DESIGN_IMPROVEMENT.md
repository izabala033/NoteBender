# NoteBender Design Improvement Plan

Reviewed on 2026-05-11.

All planned design improvement phases have been implemented in the app.

## Finished Phases

1. Shared UI foundations: added app-level classes for pages, panels, controls, buttons, icon buttons, fields, status messages, chips, horizontal scroll regions, focus rings, and reduced-motion behavior.
2. App shell and navigation: added NoteBender identity, active route styling with `NavLink`, compact secondary external links, and a segmented notation switch.
3. Route page structure: normalized route titles, page padding, max widths, top-aligned layouts, quiet panels, and shared route rhythm.
4. Harmonica visualizer: reframed the route as tuner plus harmonica map, added a stronger detected-note readout, cents meter, stop control, row labels, highlighted detected cells, and styled horizontal grid scrolling.
5. Practice trainer: added segmented modes, compact controls, row labels, clearer target card, unified microphone status, larger hit/waiting state, muted inactive notes, and stronger 12-bar active state.
6. MusicXML workspace: renamed the route component, reorganized setup/playback/score order, added icon-backed actions, improved transpose controls, grouped filters, framed the sheet viewer, and preserved existing MusicXML behavior.
7. Note highway: grouped playback controls and metrics, emphasized play/restart affordances, refined target-zone styling, stabilized lane labels, and aligned microphone status treatment.
8. Circle theory view: added selected-state summary, normalized controls, kept scrollable control rows, tightened circle labels, compacted the legend, and improved triad row structure.
9. Accessibility and responsiveness: added direct labels for icon-only and non-text controls, consistent status roles, keyboard-visible focus, touch-target cleanup, and viewport overflow checks.

## Verification

- `npm run lint` passes.
- `npm run build` passes.
- Headless Chrome viewport checks passed for `/harmonica`, `/practice`, `/musicxml`, and `/circle` at 320px, 390px, 768px, 1024px, and desktop widths.

## Manual Follow-Up

- Microphone capture and Web Audio playback still need a real-device smoke test because the automated pass cannot grant or evaluate live microphone input.
