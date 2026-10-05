import fs from 'node:fs';
import { object, sourceReviewNotice } from '../long-covid/article-detail';
import type { TrialTableRow } from '@/app/birds-eye-reviews/long-covid/types';
export function meCfsDefinition(value: unknown): string {
 const p=object(value);
 const text=JSON.stringify([p.condition_definition,p.diagnostic_criteria,p.case_definition,p.key_inclusion_criteria]).toLowerCase();
 const labels: string[]=[];
 if (/fukuda|cdc.{0,35}1994|1994.{0,35}cdc/.test(text)) labels.push('CDC / Fukuda 1994');
 if (/canadian|\bccc\b/.test(text)) labels.push('Canadian consensus');
 if (/international consensus|\bicc\b/.test(text)) labels.push('International consensus');
 if (/oxford/.test(text)) labels.push('Oxford');
 if (/\biom\b|institute of medicine|systemic exertion intolerance|\bseid\b/.test(text)) labels.push('IOM / SEID');
 if (/nice/.test(text)) labels.push('NICE');
 if (/holmes|cdc.{0,35}1988|1988.{0,35}cdc/.test(text)) labels.push('CDC / Holmes 1988');
 return labels.join(' + ') || 'Other / not specified';
}
export function loadEvidenceRows(filename: string): Map<string, Record<string,unknown>> {
 if (!fs.existsSync(filename)) return new Map();
 return new Map(fs.readFileSync(filename,'utf8').split('\n').filter(line=>line.trim()).map(line=>{const row=JSON.parse(line);return [row.id,row];}));
}
export function meCfsEvidenceFields(record: Record<string, unknown>, row?: Record<string, unknown>): Partial<TrialTableRow> {
 const reasons=Array.isArray(record.release_review_reasons)?record.release_review_reasons:[];
 const review=reasons.length>0 || object(record._extraction_inputs).requires_review===true || ['_unmerged_extractions','_merge_conflicts','_metadata_review'].some(k=>Array.isArray(record[k])?(record[k] as unknown[]).length>0:Boolean(record[k]));
 const outcomes=Array.isArray(record.outcomes)?record.outcomes:[];
 const details=object(row?.result_details), selected=Array.isArray(details.selected)?details.selected.map(object):[];
 const primary=review?undefined:selected.find(s=>s.is_primary===true && s.poolable===true);
 const n=(x:unknown)=>typeof x==='number' && Number.isFinite(x)?x:null;
 const counts=review?{}:object(row?.release_outcome_counts);
 const pos=n(counts.favors_treatment)||0, neg=n(counts.favors_control)||0, nul=n(counts.no_difference)||0;
 return {quality_notice:sourceReviewNotice(record,review) || undefined,
  verdict:review?'insufficient_data':String(row?.verdict || 'insufficient_data'),
  verdict_rationale:review?(sourceReviewNotice(record,true) || ''):String(details.reason || 'Computed by the review scientific validation rules.'),
  n_positive:pos,n_favors_control:neg,n_null:nul,n_unknown:Math.max(0,outcomes.length-pos-neg-nul),
  primary_effect_value:n(primary?.effect),primary_effect_measure:String(primary?.effect_measure||''),
  primary_higher_is_better:typeof primary?.higher_is_better==='boolean'?primary.higher_is_better:null,
  primary_ci_low:n(primary?.ci_low),primary_ci_high:n(primary?.ci_high),primary_p_value:primary?.p_value_operator==='='?n(primary?.p_value):null,
  outcomes_summary:[],promise_score:null};
}
