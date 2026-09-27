#!/usr/bin/env node
// Fails when a CSS Module animates with a keyframe it neither defines nor marks global().
// CSS Modules rename bare keyframe references, so a keyframe that lives in global CSS
// silently does nothing unless referenced as `global(name)`.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../src');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.module.css')) files.push(p);
  }
})(root);

const KEYWORDS = new Set(['none', 'inherit', 'initial', 'unset', 'global']);
let bad = 0;
for (const f of files) {
  const css = fs.readFileSync(f, 'utf8');
  const local = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
  for (const m of css.matchAll(/animation(?:-name)?\s*:\s*([^;]+);/g)) {
    const first = m[1].trim();
    if (/^global\(/.test(first)) continue;
    const name = first.split(/[\s,]/)[0];
    if (!/^[a-z]/i.test(name) || KEYWORDS.has(name) || local.has(name)) continue;
    console.error(`${path.relative(root, f)}: animation "${name}" is not defined in this module; use global(${name})`);
    bad++;
  }
}
if (bad) process.exit(1);
console.log(`keyframes ok (${files.length} modules)`);
