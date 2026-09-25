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
