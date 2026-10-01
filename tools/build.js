// Builds the minified browser files in dist/. Run with: npm run build
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const pkg = require('../package.json');

const root = path.join(__dirname, '..');
const banner = name => `/*! ${name} v${pkg.version} | MIT License | (c) 2026 Sacha | https://www.npmjs.com/package/caustic-light */`;
const jobs = [
  ['src/caustic-light.js', 'dist/caustic-light.min.js', 'caustic-light'],
  ['src/crossfade-loop.js', 'dist/crossfade-loop.min.js', 'crossfade-loop'],
];

(async () => {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  for (const [src, out, name] of jobs) {
    const code = fs.readFileSync(path.join(root, src), 'utf8');
    const result = await minify(code, { compress: true, mangle: true, format: { comments: false, preamble: banner(name) } });
    fs.writeFileSync(path.join(root, out), result.code + '\n');
    console.log(`${out}  ${(result.code.length / 1024).toFixed(1)} KB`);
  }
})().catch(err => { console.error(err); process.exit(1); });
