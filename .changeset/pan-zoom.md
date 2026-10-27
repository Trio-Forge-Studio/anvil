---
"@trioforge/anvil": minor
---

Add `PanZoom` and `usePanZoom`, a headless pan and zoom viewport for maps and skill trees.

- `PanZoom.Root`, `Viewport` and `Content` are parts over `usePanZoom`. `Viewport` and `Content` take `asChild`. The root passes the binding to its children function: `view()`, `fit()`, `scale()`, `half()`, `dragging()`, `panTo(point, { glide })` and `zoomTo(zoom, anchor)`.
- The left mouse button or one touch drags. The mouse wheel zooms by 1.15 per notch around the cursor when the viewport is the topmost `Active` or opaque object under it. A pinch that starts over the viewport zooms around its midpoint and cancels the drag.
- The zoom stays between `minZoom` and `maxZoom`, 0.5 and 1.6 by default. `clampPan(pan, scale, half)` bounds the pan. By default, content larger than the viewport keeps covering it and smaller content stays centred.
- `fit(viewportSize)` scales the content at zoom 1 and defaults to fitting it inside the viewport. Sizes are measured in logical pixels, so drags and the fit stay correct under a `UIScale` above the viewport.
- When gamepad selection moves to a control inside the content, the view glides until the control is at least 100 pixels inside the viewport. `followSelection` sets the insets or turns this off. With Reduced Motion on, glides jump instead.
- `gamepad={{ pan, zoom }}` pans with the right thumbstick and zooms with L2 and R2. It is off by default and leaves the left thumbstick and the D-pad to Roblox's selection.
- Input, glides and gamepad control stop while the owner's scope is covered by a trapped scope or the Roblox menu is open. The view `{ pan, zoom }` is controllable through `view`, `defaultView` and `onViewChange`. The viewport writes `Dragging`.
