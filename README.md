# Stained theme — UI component

**[Live demo](https://domvybe.com/components/stained-theme/)** · [Step-by-step tutorial](https://domvybe.com/library/stained-theme/) · [Download the ZIP](https://github.com/UlviShabanbayli/domvybe-stained-theme/releases/latest/download/stained-theme-source.zip)

A theme picker of stained-glass panes in a lancet window: pick a pane and the sun comes through it, its coloured light travels across the page, and the whole app takes on its colour.

Open `index.html` through any local static server (for example `python3 -m http.server`) and try it with a mouse,
a finger or the keyboard. Plain HTML, CSS and JavaScript; no build step, no libraries.

- `index.html` — the Appearance settings page: the skip link, the nav, the window box with the six panes as one radio group, the eyebrow, the headline, the lede, the live theme line, the card (Tint the editor and Follow the sun switches, the accent chip, Apply and Preview for a day, the status line and Revert), the caption, the two canvases, and a pre-paint script (the stored accent and tint, old keys, ?nofx)
- `css` — stained.css: the desktop frame on the 1600 x 1000 grid scaled by --u, the portrait composition for phones and tablets, the short-landscape layout with the window fixed on the left, every control state, the CSS window and pool without WebGL, reduced motion
- `js` — app.js (the themes, the radio group and its keys, the pick choreography, Follow the sun, the card flows, the stored theme and the themechange event, the scheduler that sleeps), glass.js (the renderer: the scene behind the page and the light over it), shaders.js (the stone, the lead and the cathedral glass, the pool of light, the colour wave), gl.js (the WebGL helper)

Vigil, its notes and its settings are made up, and the page sends nothing: Apply simulates a 650 ms save, so put your
own request in `js/app.js`. Every pick fires a `themechange` event on `document` (`detail`: the theme, its accent hex,
whether it is applied), which is the hook for the rest of your app. Everything is made in code: the limestone, the
lead cames, the cathedral glass, the sun through the picked pane, the pool of light and the colour wave are WebGL
shaders, and every word, the panes (a real radio group), the switches and the buttons are HTML; no AI pictures. Only
`dv87.v1.applied`, `dv87.v1.preview` (Preview for a day), `dv87.v1.tint` and `dv87.v1.sun` are kept in `localStorage`.
The light runs at full rate while it moves, at 30 fps for the idle dust, then sleeps. Without WebGL (or with `?nofx`,
or when the context is lost) the window and the pool are CSS. `?locked` shows the admin-managed state, `?offline` a
failed save, `?fast` a quick save and `?hour=H` sets the hour Follow the sun reads. The page reads Google Fonts
(Cormorant Garamond, Inter).

It respects `prefers-reduced-motion`. Made by Ulvi (Code with Ulvi) · domvybe.com

## Licence

MIT — see [LICENSE](LICENSE). Use it in your own projects, commercial ones included.
