# React-Phaser UI Guidelines

These guidelines define the UI boundary for Pirate Game. New player-facing UI must follow them so React and Phaser remain independently understandable and the game loop stays authoritative.

## Ownership boundary

- Use React DOM for player-facing, screen-space UI: HUDs, menus, dialogs, inventories, tooltips, and settings.
- Keep simulation, entities, physics, cameras, world rendering, world hit testing, controls, and scene transitions in Phaser.
- World-space indicators and development/debug overlays may remain in Phaser when they must follow world coordinates or Phaser internals.
- React requests an action; Phaser validates and applies it. A React component must not directly mutate the game.

## Mounting and layering

- Mount one React root in `#game-ui` above one Phaser canvas in its sibling `#game` element.
- Create the React root once during application startup. Never recreate it for a scene or component.
- Keep `#game-ui` positioned over the game shell. DOM `z-index` orders React relative to the canvas; Phaser `depth` orders objects only inside the canvas. Neither value crosses that boundary.
- Design from the Phaser reference resolution of `960x540`, but size and position UI responsively with the game shell, container units, and bounded `clamp()` values.

## React-Phaser bridge

- Exchange narrow, typed data: semantic immutable snapshots from Phaser and typed commands or actions from React.
- Never expose mutable Phaser scenes, game objects, physics bodies, cameras, or input objects to React.
- Publish UI state only when its meaning changes. Deduplicate equivalent snapshots and never drive React rendering at the Phaser frame rate.
- Use the current `gameHudStore` and React `useSyncExternalStore` integration as the default store pattern. Introduce another state or UI dependency only when a demonstrated requirement cannot be met by the existing project dependencies.
- Prefer domain values such as `sailState`, `rudder`, or `selectedTargetId` over rendered values such as image paths, angles, or CSS classes. Map domain state to presentation inside the UI layer.

## Scene lifecycle

- On scene creation, publish the complete initial UI state and show the relevant overlay.
- During the scene, publish only meaningful state changes. The bridge must deduplicate repeated values even if a scene calls it from `update`.
- Register scene lifecycle cleanup once. On `Phaser.Scenes.Events.SHUTDOWN`, hide or reset scene-owned UI and remove any subscriptions or listeners created by that scene.
- Treat restart and transition paths like fresh entry. No UI state from the previous scene instance may remain visible.

## Components and styles

- Place small, typed, presentational React components under `src/ui`.
- Keep state-to-label and state-to-asset mappings explicit and exhaustive, preferably with typed `Record` values.
- Co-locate UI CSS under `src/ui` and use BEM-like class names such as `game-hud__status` and `sail-status__image`.
- Reuse established project dependencies and primitives before proposing a package or shared abstraction.
- Keep gameplay decisions out of JSX, event handlers, and CSS.

## Input layering

- Make passive overlays `pointer-events: none` so aiming, dragging, and world interaction continue to reach Phaser.
- Opt only interactive controls into `pointer-events: auto`.
- Interactive controls must support keyboard and focus operation, with visible focus and disabled states.
- Arbitrate keyboard input while DOM UI owns focus. Phaser must not also process arrows, Escape, typing, or other keys consumed by the focused UI.
- Dialogs and menus must establish initial focus, trap focus when modal, restore focus when closed, and explicitly define whether the UI or Phaser owns Escape.
- Verify that adding UI does not swallow Phaser input outside the interactive element.
- Send typed commands from UI controls; do not capture and mutate Phaser objects from a component.

## Pixel art and assets

- Reuse assets under `public/assets` and preserve existing variants. The current root-hosted build may use `/assets/...`; deployments with a non-root Vite base must use `import.meta.env.BASE_URL`, asset imports, or another base-aware construction.
- Use CSS for ordinary surfaces and SVG for scalable decorative artwork.
- Use CSS `border-image` or an explicit nine-slice composition when a raster frame must resize. A fixed-size raster frame, or one scaled as a whole by a whole-number factor, may remain intact.
- A CSS `border-image` implementation must declare explicit slice and border widths plus an intentional repeat or stretch policy for edges and the center.
- Do not arbitrarily stretch a complete raster panel or button.
- Prefer individual exports or source atlas metadata over manually guessed sprite regions when either is available.
- Apply `image-rendering: pixelated` where raster pixel art is scaled.
- Favor whole-number visual scaling for pixel art. Responsive sizing may use container units and clamps, but inspect the result for uneven pixels at constrained sizes.

## Accessibility

- Use native semantic elements and visible labels or text equivalents for controls and status.
- Mark purely decorative art with `aria-hidden="true"` or an empty image alternative.
- Use `role="status"` and `aria-live` only for changes that are useful when announced; avoid repeated announcements from continuous input.
- Respect `prefers-reduced-motion` and remove nonessential transitions or animation.
- Maintain readable text at the smallest supported game-shell size; do not shrink status text below a practical font floor.

## Validation checklist

- Run `npm run build`.
- Run `git diff --check`.
- Browser-test wide and narrow constrained game-shell sizes.
- Exercise all three sail states and all rudder states.
- Exercise scene entry, exit, restart, and transition paths.
- Confirm pointer input passes through passive UI; interactive controls work with keyboard and visible focus; and focused DOM UI suppresses conflicting Phaser keys.
- Test with reduced motion enabled.
- Inspect pixel-art edges for crisp, unstretched rendering and, when nine-slice is used, inspect every join.
- Verify behavior under `Phaser.AUTO` with both WebGL and Canvas rendering where available.

Build and static checks do not constitute visual or runtime acceptance. A UI change is accepted only after the relevant browser interactions and rendering modes have been exercised.

## Anti-patterns

- Mounting or unmounting the React root when a Phaser scene changes.
- Passing a scene, game object, physics body, camera, or mutable state object into React.
- Calling React state setters every Phaser frame.
- Letting React decide whether a gameplay action is valid.
- Leaving HUD state visible after scene shutdown or restart.
- Enabling pointer events across the entire overlay.
- Dynamically constructing presentation paths or CSS classes from domain strings instead of using an exhaustive typed mapping.
- Stretching raster frames, guessing atlas coordinates when metadata exists, or using fractional pixel-art scaling without inspection.
- Adding a UI framework or state library without a concrete need.

## Current reference implementation

- [src/main.tsx](../src/main.tsx): persistent React root and Phaser game creation.
- [src/ui/GameHudOverlay.tsx](../src/ui/GameHudOverlay.tsx): typed presentational HUD and explicit state mappings.
- [src/ui/gameHudStore.ts](../src/ui/gameHudStore.ts): immutable snapshots, deduplication, and subscription bridge.
- [src/ui/gameHud.css](../src/ui/gameHud.css): overlay layering, responsive sizing, pixel rendering, and reduced motion.
- [src/scenes/ArchipelagoScene.ts](../src/scenes/ArchipelagoScene.ts): authoritative state publication and scene shutdown cleanup.
