/* Parses the game's inline <script> without running it. A syntax error in
   that block kills the whole game silently — the browser reports nothing
   useful when the page is a single file — so this is the first thing to
   run after any edit. Run from the repo root: node tools/check.js */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
const m = fs.readFileSync(file, 'utf8').match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.log('NO <script> BLOCK FOUND'); process.exit(1); }
try {
  new Function(m[1]);
  console.log('PARSE OK (' + m[1].split('\n').length + ' lines)');
} catch (e) {
  console.log('PARSE ERROR: ' + e.message);
  process.exit(1);
}
