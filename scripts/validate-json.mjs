import fs from 'node:fs';

const path = 'src/data/routines.json';
let raw = '';

try {
   raw = fs.readFileSync(path, 'utf8');
} catch (e) {
   console.error(`[validate-json] Cannot read: ${path}`);
   throw e;
}

console.log(`[validate-json] bytes=${Buffer.byteLength(raw, 'utf8')}`);

if (!raw.trim()) {
   console.error('[validate-json] File is EMPTY or whitespace-only.');
   process.exit(1);
}

try {
   JSON.parse(raw);
   console.log('[validate-json] JSON parse OK');
} catch (e) {
   console.error('[validate-json] JSON parse FAIL:', e.message);
   console.error('\n--- tail(300 chars) ---');
   console.error(raw.slice(Math.max(0, raw.length - 300)));
   console.error('\n----------------------');
   process.exit(1);
}
