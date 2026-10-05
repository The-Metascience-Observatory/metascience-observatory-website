import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { meCfsDefinition, meCfsEvidenceFields } from '../lib/birds-eye-reviews/mecfs';
import { reviewArticles, reviewArticle, reviewDataPath } from '../lib/birds-eye-reviews/data';
import { loadReviewDashboardData } from '../lib/birds-eye-reviews/dashboard-data';

test('ME/CFS criteria derive from reported eligibility text',()=>{
 assert.equal(meCfsDefinition({diagnostic_criteria:'CDC Fukuda 1994'}),'CDC / Fukuda 1994');
 assert.equal(meCfsDefinition({case_definition:'Canadian consensus criteria'}),'Canadian consensus');
 assert.equal(meCfsDefinition({key_inclusion_criteria:['Biomarker evaluation']}),'Other / not specified');
 assert.equal(meCfsDefinition({min_time_since_infection_weeks:12}),'Other / not specified');
});
test('source holds suppress both favorable and unfavorable numbers',()=>{
 for(const field of ['_unmerged_extractions','_merge_conflicts','_metadata_review']) {
  const result=meCfsEvidenceFields({[field]:[{reason:'pending'}],outcomes:[{}]}, {verdict:'favors_treatment',release_outcome_counts:{favors_treatment:1},result_details:{selected:[{is_primary:true,poolable:true,effect:1,p_value:.01}]}});
  assert.equal(result.verdict,'insufficient_data');assert.equal(result.primary_p_value,null);assert.equal(result.n_positive,0);assert.equal(result.n_unknown,1);assert(result.quality_notice);
 }
});
test('review article caches and publication metadata cannot cross review boundaries',()=>{
 const originalMe=process.env.ME_CFS_DATA_DIR,originalLc=process.env.LONG_COVID_DATA_DIR;
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'me-review-test-'));
 try {
  for(const slug of ['me-cfs','long-covid'] as const) {
   const dir=path.join(tmp,slug);fs.mkdirSync(dir);
   process.env[slug==='me-cfs'?'ME_CFS_DATA_DIR':'LONG_COVID_DATA_DIR']=dir;
   fs.writeFileSync(path.join(dir,'last_updated.json'),JSON.stringify({release_version:'same-version'}));
   fs.writeFileSync(path.join(dir,'trial_extractions.jsonl'),JSON.stringify({paper_id:'10.test/shared',_status:'ok',title:slug,study_design:{design_type:'RCT'},outcomes:[],participants:{notes:'/home/private/file'},_secret:'hidden'})+'\n');
  }
  assert.equal(reviewArticles('me-cfs').records.size,1);
  assert.equal(reviewArticle('me-cfs','10.test/shared')?.reference.title,'me-cfs');
  assert.equal(reviewArticle('long-covid','10.test/shared')?.reference.title,'long-covid');
  assert(!JSON.stringify(reviewArticle('me-cfs','10.test/shared')).includes('/home/private'));
  assert(!JSON.stringify(reviewArticle('me-cfs','10.test/shared')).includes('_secret'));
 } finally {
  if(originalMe===undefined)delete process.env.ME_CFS_DATA_DIR;else process.env.ME_CFS_DATA_DIR=originalMe;
  if(originalLc===undefined)delete process.env.LONG_COVID_DATA_DIR;else process.env.LONG_COVID_DATA_DIR=originalLc;
  fs.rmSync(tmp,{recursive:true,force:true});
 }
});
test('installed treatment preview has consistent article, table and metadata sets',()=>{
 const d=loadReviewDashboardData('me-cfs');
 const marker=JSON.parse(fs.readFileSync(reviewDataPath('me-cfs','PREVIEW_STATUS.json'),'utf8'));
 assert.equal(d.tableRows.length,marker.n_reports);
 assert.deepEqual(d.trialMetas.map(r=>r.paper_id).sort(),d.tableRows.map(r=>r.paper_id).sort());
 assert.equal(d.tableRows.filter(r=>r.quality_notice).length,marker.source_review_pending);
 for(const row of d.tableRows) {
  assert(reviewArticle('me-cfs',row.paper_id));
  if(row.quality_notice) {
   assert.equal(row.primary_p_value,null);assert.equal(row.n_positive,0);
   assert.equal(d.trialMetas.find(m=>m.paper_id===row.paper_id)?.primary_p_value,null);
  }
 }
});

test('completed source review never restores held numerical conclusions',()=>{
 const result=meCfsEvidenceFields({release_review_reasons:['source_findings'],release_extraction_review_state:'complete_with_limitations',outcomes:[{}]}, {verdict:'favors_treatment',release_outcome_counts:{favors_treatment:1},result_details:{selected:[{is_primary:true,poolable:true,effect:1,p_value:.01}]}});
 assert.match(result.quality_notice || '',/Extraction has been reviewed/);
 assert.equal(result.verdict,'insufficient_data');assert.equal(result.primary_p_value,null);assert.equal(result.n_positive,0);assert.equal(result.n_unknown,1);
});
