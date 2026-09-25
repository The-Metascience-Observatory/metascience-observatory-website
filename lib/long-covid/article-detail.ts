/** Public projection only: never serialize a raw pipeline record to the browser. */
export type DetailValue = string | number | boolean | null | DetailValue[] | { [key: string]: DetailValue };
export interface ArticleDetail {
  paperId: string; releaseVersion: string;
  reference: { title: string; authors: string; journal: string; year: string; volume: string; issue: string; pages: string; doiUrl: string; explorerUrl: string };
  design: string; participantCount: number | null; riskOfBias: string;
  completeness: 'No outcomes reported' | 'Outcome statistics incomplete' | 'Numerical results available';
  population: DetailValue; interventions: DetailValue[]; comparators: DetailValue[];
  comparatorStatus: 'Reported' | 'No comparator' | 'Not reported';
  outcomes: { name: string; primary: boolean | null; instrument: string; domain: string; units: string; timepoints: DetailValue; armResults: DetailValue; betweenGroupEffects: DetailValue; withinGroupChanges: DetailValue }[];
  verifiedFindings: DetailValue; publication: DetailValue; provenance: DetailValue; limitations: DetailValue;
}
export const normalizePaperId = (id: string) => id.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/--/g, '/').toLowerCase();
export const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const str = (v: unknown): string => typeof v === 'string' || typeof v === 'number' ? String(v).replace(/<[^>]*>/g, '') : '';
/** No transport or private local paths in public records, even in notes. */
function clean(v: unknown): DetailValue {
  if (v == null) return null;
  if (typeof v === 'string') return str(v).replace(/(?:file:\/\/)?\/(?:home|tmp|media|mnt)\/[^\s"<>]+/g, '[local source]');
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map(clean);
  return Object.fromEntries(Object.entries(object(v)).filter(([k]) => !k.startsWith('_') && !/path|credential|token|secret|source_file/i.test(k)).map(([k,x]) => [k,clean(x)]));
}
export function isPublishedArticle(r: Record<string, unknown>, excluded: Set<string>): boolean {
  const sd=object(r.study_design), id=normalizePaperId(str(r.paper_id));
  return !!id && !!r.study_design && !excluded.has(id.split('#')[0]) && !/not applicable|bioinformatic|not a clinical trial/i.test(str(sd.design_type));
}
export function articleDetail(r: Record<string, unknown>, releaseVersion: string, publication: unknown = null): ArticleDetail {
  const sd=object(r.study_design), samples=object(r.sample_sizes), arms=array(sd.arms).map(object), id=normalizePaperId(str(r.paper_id));
  const interventions=arms.filter(a=>a.type==='intervention');
  const comparators=arms.filter(a=>a.type!=='intervention' && /control|comparator|placebo|usual_care|sham/i.test(str(a.type)));
  const outcomes=array(r.outcomes).map(object);
  const hasNumbers=outcomes.some(o=>['arm_results','between_group_effects','within_group_change'].some(k=>array(o[k]).some(v=>Object.entries(object(v)).some(([key,val])=>/^(mean|sd|median|events|percent|effect_value|p_value|change_mean|ci_95_low|ci_95_high)$/.test(key) && val!=null))));
  const n=samples.n_randomized_total ?? samples.n_enrolled_total;
  const reference = {title:str(r.title)||id, authors:Array.isArray(r.authors)?r.authors.map(str).join('; '):str(r.authors),journal:str(r.journal),year:str(r.year),volume:str(r.volume),issue:str(r.issue),pages:str(r.pages),doiUrl:id.startsWith('10.')?`https://doi.org/${encodeURI(id.split('#')[0])}`:'',explorerUrl:`https://explore.metascienceobservatory.org/doi/${encodeURIComponent(id.split('#')[0])}`};
  return {paperId:id,releaseVersion,reference,design:str(sd.design_type)||'Not reported',participantCount:typeof n==='number'?n:null,riskOfBias:str(object(r.risk_of_bias).overall_judgment)||'Not reported',completeness:!outcomes.length?'No outcomes reported':hasNumbers?'Numerical results available':'Outcome statistics incomplete',population:clean({...object(r.participants),setting:sd.setting,baseline_demographics:r.baseline_demographics}),interventions:interventions.map(clean),comparators:comparators.map(clean),comparatorStatus:comparators.length?'Reported':sd.has_comparison_group===false || (sd.num_arms===1 && interventions.length===1)?'No comparator':'Not reported',outcomes:outcomes.map(o=>({name:str(o.name)||'Unnamed outcome',primary:typeof o.is_primary==='boolean'?o.is_primary:null,instrument:str(o.measurement_instrument),domain:str(o.symptom_domain),units:str(o.unit||o.units),timepoints:clean(o.timepoints),armResults:clean(o.arm_results),betweenGroupEffects:clean(o.between_group_effects),withinGroupChanges:clean(o.within_group_change)})),verifiedFindings:clean(r.release_verified_findings),publication:clean(publication),provenance:clean({model:r._model,release:releaseVersion,...object(r.release_provenance)}),limitations:clean({notes:object(r.extraction_metadata).extractor_notes,limitations:r.release_limitations,follow_up:r.follow_up})};
}
