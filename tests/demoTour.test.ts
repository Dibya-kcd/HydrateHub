import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { parseDemoHash, demoHref } from '../src/demo/demoRoute';
import { TOURS, OWNER_JUMP } from '../src/demo/tourData';

test('demo links: chooser, tour and step', () => {
  assert.deepEqual(parseDemoHash('#/demo'), { kind: 'chooser' });
  assert.deepEqual(parseDemoHash('#/demo/'), { kind: 'chooser' });
  assert.deepEqual(parseDemoHash('#/demo/salesman'), { kind: 'tour', tour: 'salesman', step: 0 });
  assert.deepEqual(parseDemoHash('#/demo/owner/7'), { kind: 'tour', tour: 'owner', step: 6 });
  assert.deepEqual(parseDemoHash('#/Demo/Owner/99'), { kind: 'tour', tour: 'owner', step: 21 });
  assert.deepEqual(parseDemoHash('#/demo/owner/0'), { kind: 'tour', tour: 'owner', step: 0 });
  assert.deepEqual(parseDemoHash('#/demo/unknown'), { kind: 'chooser' });
});

test('other addresses are not demo links', () => {
  for (const h of ['', '#', '#/', '#/settings', '#demo-not', '#/demonstration']) assert.equal(parseDemoHash(h), null, h);
});

test('demoHref round-trips', () => {
  assert.equal(demoHref(), '#/demo');
  assert.equal(demoHref('salesman'), '#/demo/salesman');
  assert.deepEqual(parseDemoHash(demoHref('owner', 11)), { kind: 'tour', tour: 'owner', step: 11 });
});

test('tour content: 12 salesman and 22 owner steps, complete and safe', () => {
  assert.equal(TOURS.salesman.steps.length, 12);
  assert.equal(TOURS.owner.steps.length, 22);
  for (const t of Object.values(TOURS)) {
    for (const s of t.steps) {
      assert.ok(s.title && s.what && s.action && s.chapter && s.sample && s.html, `${t.id}: ${s.title}`);
      assert.ok(!/<script|\son\w+\s*=|javascript:/i.test(s.html), `${s.title}: unsafe markup`);
      if (s.tap) assert.ok(s.tap.left >= 0 && s.tap.left <= 100 && s.tap.top >= 0 && s.tap.top <= 172 - 34, `${s.title}: tap position`);
    }
  }
});

test('owner "Jump to topic" only points at real steps', () => {
  const n = TOURS.owner.steps.length;
  for (const g of OWNER_JUMP) for (const it of g.items) assert.ok(it.step >= 1 && it.step <= n, `${g.group}/${it.label}`);
});

test('demo is isolated: imports nothing from the data layer and makes no network call', () => {
  const dir = path.resolve(__dirname, '../src/demo');
  for (const f of fs.readdirSync(dir).filter((x) => /\.(ts|tsx)$/.test(x))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      assert.ok(spec === 'react' || spec.startsWith('./'), `${f} imports "${spec}"`);
    }
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|supabase/i.test(src), `${f} touches network/storage`);
  }
});
