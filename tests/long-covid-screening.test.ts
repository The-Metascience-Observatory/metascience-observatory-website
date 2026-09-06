import assert from 'node:assert/strict';
import test from 'node:test';
import { computeScreeningCounts } from '../app/birds-eye-reviews/long-covid/screening/screening-counts';

test('keeps unresolved screening, missing extractions, report units and dashboard exclusions distinct', () => {
  const counts = computeScreeningCounts([
    {doi:'10/a',is_excluded:'yes',exclusion_reason:''},
    {doi:'10/b',is_excluded:'no',exclusion_reason:''},
    {doi:'10/c',is_excluded:'',exclusion_reason:''},
    {doi:'10/d',is_excluded:'no',exclusion_reason:''},
  ], [
    {paper_id:'10/a',study_design:{design_type:'RCT'},is_rct:true},
    {paper_id:'10/b#arm1',study_design:{design_type:'RCT'},is_rct:true},
    {paper_id:'10/b#arm2',study_design:{design_type:'RCT'},is_rct:true},
    {paper_id:'10/c',study_design:{design_type:'not a clinical trial'}},
    {paper_id:'10/e',study_design:{design_type:'before_after'}},
    {paper_id:'10/f'},
  ], {as_of:'2026-03-08',dois:['10/A','10/a','10/d']});
  assert.equal(counts.screened,4);
  assert.equal(counts.excluded,1);
  assert.equal(counts.explicitNo,2);
  assert.equal(counts.unresolved,1);
  assert.equal(counts.retainedWithExtraction,2);
  assert.equal(counts.retainedWithoutExtraction,1);
  assert.equal(counts.exportedExcluded,1);
  assert.equal(counts.exportedInvalid,2);
  assert.equal(counts.exportedUnscreened,2);
  assert.equal(counts.dashboardRecords,3);
  assert.equal(counts.dashboardReports,2);
  assert.equal(counts.randomized,2);
  assert.equal(counts.other,1);
  assert.equal(counts.historicalFailures,2);
  assert.equal(counts.historicalNowExported,1);
  assert.equal(counts.historicalWithoutExtraction,1);
  assert.equal(counts.screened,counts.excluded+counts.retained);
  assert.equal(counts.retained,counts.retainedWithExtraction+counts.retainedWithoutExtraction);
  assert.equal(counts.exported,counts.exportedExcluded+counts.exportedInvalid+counts.dashboardRecords);
  assert.deepEqual(counts.reasons,{Unspecified:1});
});

test('does not call a design randomized just because its label contains randomized', () => {
  const c=computeScreeningCounts([], [{paper_id:'10/a',study_design:{design_type:'non-randomized'}}], {as_of:'2026-03-08',dois:[]});
  assert.equal(c.randomized,0);
  assert.equal(c.other,1);
  assert.equal(c.historicalFailures,0);
});
