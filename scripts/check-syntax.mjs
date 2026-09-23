/**
 * check-syntax.mjs — Syntax-check every ES module without executing it.
 *
 *   node scripts/check-syntax.mjs   (or `npm run check`)
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['js'];
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
}
for (const r of roots) walk(r);

let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    console.log(`ok   ${f}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${f}`);
    console.error(String(e.stderr || e.message));
  }
}
process.exit(failed ? 1 : 0);
