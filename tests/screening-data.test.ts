import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { GET as screening } from '../app/api/screening/route';
import { GET as download } from '../app/api/screening/download/route';

test('screening API and download share the bundle resolver and invalidate cached rows', async () => {
 const original=process.env.LONG_COVID_DATA_DIR;
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'long-covid-screening-'));
 const first=path.join(temp,'first'),second=path.join(temp,'second');
 fs.mkdirSync(first);fs.mkdirSync(second);
 const csv='doi,is_excluded,paper_title\n10.1000/a,no,Staged article\n';
 fs.writeFileSync(path.join(first,'trial_screening.csv'),csv);
 fs.writeFileSync(path.join(second,'trial_screening.csv'),csv+'10.1000/b,unknown,Pending source\n');
 try {
  process.env.LONG_COVID_DATA_DIR=first;
  const a=await (await screening(new NextRequest('http://localhost/api/screening?limit=1'))).json();
  assert.equal(a.total,1);assert.equal(a.rows[0].title,'Staged article');
  assert.equal(await (await download()).text(),csv);
  process.env.LONG_COVID_DATA_DIR=second;
  const b=await (await screening(new NextRequest('http://localhost/api/screening?limit=1'))).json();
  assert.equal(b.total,2);assert.equal(b.rows.length,1);
  assert.match(await (await download()).text(),/Pending source/);
 } finally {
  if(original===undefined)delete process.env.LONG_COVID_DATA_DIR;else process.env.LONG_COVID_DATA_DIR=original;
  fs.rmSync(temp,{recursive:true,force:true});
 }
});
