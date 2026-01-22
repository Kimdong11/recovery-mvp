// scripts/validate-json.mjs
import fs from 'node:fs';

const path = 'src/data/routines.json';

let raw = '';
try {
   raw = fs.readFileSync(path, 'utf8');
} catch (e) {
   console.error(`[validate-json] Cannot read file: ${path}`);
   process.exit(1);
}

const bytes = Buffer.byteLength(raw, 'utf8');
console.log(`[validate-json] bytes=${bytes}`);

const head = raw.slice(0, 120).replace(/\n/g, '\\n');
const tail = raw.slice(Math.max(0, raw.length - 220)).replace(/\n/g, '\\n');
console.log(`[validate-json] head="${head}"`);
console.log(`[validate-json] tail="${tail}"`);

if (!raw.trim()) {
   console.error('[validate-json] FAIL: file is EMPTY/whitespace.');
   process.exit(1);
}

try {
   JSON.parse(raw);
   console.log('[validate-json] JSON parse OK');
} catch (e) {
   console.error('[validate-json] JSON parse FAIL:', e.message);
   process.exit(1);
}
