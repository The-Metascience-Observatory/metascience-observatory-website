import test from 'node:test';
import assert from 'node:assert/strict';
import { articleDetail, isPublishedArticle, normalizePaperId } from '../lib/long-covid/article-detail';
test('public projection preserves inequality p values and distinguishes uncontrolled studies',()=>{
 const detail=articleDetail({paper_id:'10.X/ABC#arm1',study_design:{design_type:'before_after',has_comparison_group:false,arms:[{arm_id:1,type:'intervention',label:'Rehab'}]},outcomes:[{name:'Fatigue',is_primary:false,between_group_effects:[],within_group_change:[{change_mean:-2,p_value:'<0.001'}]}],_source_file:'/home/dan/private.pdf',extraction_metadata:{extractor_notes:'See /home/dan/private/body.md'}},'release1');
 assert.equal(detail.comparatorStatus,'No comparator');assert.equal(detail.outcomes[0].primary,false);assert.equal((detail.outcomes[0].withinGroupChanges as {p_value:string}[])[0].p_value,'<0.001');assert(!JSON.stringify(detail).includes('/home/dan'));assert.equal(detail.releaseVersion,'release1');
});
test('unknown comparator and missing outcomes stay explicit',()=>{
 const d=articleDetail({paper_id:'10.a/b',study_design:{arms:[]}},'v');assert.equal(d.comparatorStatus,'Not reported');assert.equal(d.completeness,'No outcomes reported');assert.equal(d.participantCount,null);
});
test('identity and eligibility shared across feeds and detail lookup',()=>{
 assert.equal(normalizePaperId('https://doi.org/10.A/B#arm1'),'10.a/b#arm1');assert(!isPublishedArticle({paper_id:'10.A/B#arm1',study_design:{}},new Set(['10.a/b'])));assert(!isPublishedArticle({paper_id:'10.a/b',study_design:{design_type:'not a clinical trial'}},new Set()));
});

test('harm details preserve unknown arm attribution and public provenance boundaries',()=>{
 const detail=articleDetail({paper_id:'10.test/harms',study_design:{arms:[]},
  adverse_events:{reporting_quality:'summary_only',per_arm:[{arm_id:1,n_deaths:null}],source_file:'/home/private/body.md'},
  _pooled_adverse_events:{arm_ids:[1,2,3],n_deaths:1,event:'Death during follow-up',individual_arm:'not reported',source_location:'PDF page 3',causal_attribution:'Undetermined',private_path:'/home/private/audit.json',secret:'do not expose'}},'v');
 const harms=detail.adverseEvents as {per_arm:{n_deaths:null}[],pooled_events:{arm_ids:number[],n_deaths:number,individual_arm:string}};
 assert.equal(harms.per_arm[0].n_deaths,null);assert.equal(harms.pooled_events.n_deaths,1);
 assert.deepEqual(harms.pooled_events.arm_ids,[1,2,3]);assert.equal(harms.pooled_events.individual_arm,'not reported');
 assert(!JSON.stringify(detail).includes('/home/private'));assert(!JSON.stringify(detail).includes('do not expose'));
 assert.equal(detail.reviewNotice,null);
 assert.equal(articleDetail({paper_id:'10.test/missing',study_design:{}},'v').adverseEvents,null);
});
test('article source holds remain visible while raw extracted results can be inspected',()=>{
 for(const hold of [{release_review_reasons:['source_coverage']},{_extraction_inputs:{requires_review:true}},{_unmerged_extractions:[{}]},{_merge_conflicts:[{}]},{_metadata_review:[{}]},{_source_findings:[{severity:'blocking',reason:'Source mismatch'}]}]) {
  const detail=articleDetail({paper_id:'10.test/held',study_design:{},outcomes:[{name:'Fatigue',arm_results:[{mean:3}]}],...hold},'v');
  assert.match(detail.reviewNotice||'',/not approved for synthesis/);
  assert.deepEqual(detail.outcomes[0].armResults,[{mean:3}]);
 }
});

test('waiting-list arms appear as reported comparators',()=>{
 for(const type of ['waitlist','waiting_list','wait-list','waiting list']) {
  const d=articleDetail({paper_id:'10.test/waitlist',study_design:{arms:[{arm_id:1,type:'intervention'},{arm_id:2,type,label:'Waiting list'}]}},'v');
  assert.equal(d.comparatorStatus,'Reported');assert.equal(d.comparators.length,1);
  assert.equal((d.comparators[0] as {label:string}).label,'Waiting list');
 }
});
test('pooled harms lists retain qualitative findings without exposing private fields',()=>{
 const d=articleDetail({paper_id:'10.test/pooled',study_design:{},_pooled_adverse_events:[
  {arm_ids:[1,2],event:'No substantive adverse events reported',source_location:'PDF page 9',private_path:'/home/private/audit.json'},
  {arm_ids:[1,2],event:'Eight serious adverse events; arm allocation unspecified',secret:'do not expose'}]},'v');
 const harms=d.adverseEvents as {pooled_events:{event:string,arm_ids:number[]}[]};
 assert.equal(harms.pooled_events.length,2);assert.match(harms.pooled_events[0].event,/No substantive/);
 assert.deepEqual(harms.pooled_events[1].arm_ids,[1,2]);
 assert(!JSON.stringify(d).includes('/home/private'));assert(!JSON.stringify(d).includes('do not expose'));
});

test('analyzed-only observational populations retain a participant count', () => {
  const detail = articleDetail({ paper_id: '10.test/cohort', study_design: { design_type: 'observational' },
    sample_sizes: { n_randomized_total: null, n_enrolled_total: null, n_analyzed_total: 739 } }, 'test-release');
  assert.equal(detail.participantCount, 739);
});

test('completed extraction retains a visible synthesis limitation',()=>{
 const result=articleDetail({paper_id:'10.test/reviewed',study_design:{design_type:'RCT'},outcomes:[],release_review_reasons:['source_findings'],release_extraction_review_state:'complete_with_limitations'},'reviewed');
 assert.match(result.reviewNotice || '',/Extraction has been reviewed/);
 assert.match(result.reviewNotice || '',/not approved for synthesis/);
});


test('pooled changes and responder data stay visible without becoming treatment contrasts',()=>{
 const d=articleDetail({paper_id:'10.test/pooled-results',study_design:{design_type:'crossover'},
  sample_sizes:{n_randomized_total:60,diagnostic_groups:[{diagnosis:'ME/CFS',n:12}],private_path:'/home/private/flow'},
  release_review_reasons:['source_coverage'],outcomes:[{name:'Fatigue',arm_results:[],between_group_effects:[],
   pooled_adjusted_changes:[{estimate:-4.14,ci_95_low:-6.87,ci_95_high:-1.41,source_file:'/media/private/table'}],
   responder_groups:[{events:20,total:46}],reported_response:{percent:43.48,note:'Audit /home/private/source.md'},
   _internal_trace:'private trace',unapproved_debug:'private debug'}]},'v');
 assert.equal(d.completeness,'Numerical results available');
 assert.deepEqual(d.outcomes[0].betweenGroupEffects,[]);
 const extra=d.outcomes[0].additionalResults as {pooled_adjusted_changes:{estimate:number}[],responder_groups:{events:number,total:number}[]};
 assert.equal(extra.pooled_adjusted_changes[0].estimate,-4.14);
 assert.deepEqual(extra.responder_groups,[{events:20,total:46}]);
 assert.match(d.reviewNotice||'',/not approved for synthesis/);
 assert.match(JSON.stringify(d.population),/ME\/CFS/);
 assert(!/\/home\/private|\/media\/private|private trace|private debug/.test(JSON.stringify(d)));
 assert.equal(articleDetail({paper_id:'10.test/empty',study_design:{},outcomes:[{name:'Fatigue'}]},'v').outcomes[0].additionalResults,null);
});


test('pooled cohort results retain their scope outside randomized arm contrasts',()=>{
 const d=articleDetail({paper_id:'10.test/pooled-followup',study_design:{design_type:'RCT'},
  release_review_reasons:['source_findings'],outcomes:[{name:'Global change',arm_results:[],between_group_effects:[],
   pooled_results:{population:'Original treated groups; completers',rows:[{events:70,total:90,source_file:'/media/private/table',_original_record:'private trace'}]}}]},'v');
 const extra=d.outcomes[0].additionalResults as {pooled_results:{population:string,rows:{events:number,total:number}[]}};
 assert.equal(d.completeness,'Numerical results available');
 assert.equal(extra.pooled_results.population,'Original treated groups; completers');
 assert.deepEqual(extra.pooled_results.rows,[{events:70,total:90}]);
 assert.deepEqual(d.outcomes[0].armResults,[]);
 assert.deepEqual(d.outcomes[0].betweenGroupEffects,[]);
 assert.match(d.reviewNotice||'',/not approved for synthesis/);
 assert(!/private trace|\/media\/private/.test(JSON.stringify(d)));
});
