import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadInspectSnapshot } from '../lib/long-covid/inspect-server';

test('staged INSPECT coverage cannot fall back to the installed release', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'long-covid-inspect-'));
  const previous = process.env.LONG_COVID_DATA_DIR;
  try {
    process.env.LONG_COVID_DATA_DIR = dir;
    assert.equal(loadInspectSnapshot(), undefined);
    const snapshot = {version: 1, assessedAt: '2026-10-04', papers: {}};
    writeFileSync(path.join(dir, 'inspect_sr.json'), JSON.stringify(snapshot));
    assert.deepEqual(loadInspectSnapshot(), snapshot);
    writeFileSync(path.join(dir, 'inspect_sr.json'), JSON.stringify({version: 2}));
    assert.throws(() => loadInspectSnapshot(), /Unsupported INSPECT-SR snapshot/);
  } finally {
    if (previous === undefined) delete process.env.LONG_COVID_DATA_DIR;
    else process.env.LONG_COVID_DATA_DIR = previous;
    rmSync(dir, {recursive: true, force: true});
  }
});
