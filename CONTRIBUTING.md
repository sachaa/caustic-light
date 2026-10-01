# Contributing

Thanks for helping make `caustic-light` better. Bug reports, presets, examples
and fixes are all welcome.

## Run it locally

Browsers will not load the example music (or any `fetch`) from `file://`, so
serve the repository root over HTTP:

```bash
npm start            # same as: python3 -m http.server 8000 --bind 127.0.0.1
```

Then open <http://localhost:8000/examples/>. The examples load the source file
`src/caustic-light.js` directly, so a page reload picks up your edits. There is
no build step during development.

## Before you open a pull request

```bash
npm install          # installs terser for the minified build
npm run check        # syntax check of both source files
npm run build        # regenerates dist/*.min.js
```

- Try your change in at least Chrome and Safari (Firefox too, if you can). The
  renderer leans on WebGL2 float render targets, which differ between GPUs.
- Open the playground (`examples/playground.html`) and step through every preset.
  Watch for sparkling dots on bright lines, black frames or a drop in frame rate.
- Keep the component dependency-free and in a single file.
- If you add or change an attribute, update the header comment in
  `src/caustic-light.js`, the README reference table, `types/caustic-light.d.ts`
  and `CHANGELOG.md` in the same pull request.

## Reporting bugs

Please include the browser and version, the operating system and GPU, the exact
tag or options you used, and the output of `element.stats`.
