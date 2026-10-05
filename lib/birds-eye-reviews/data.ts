import fs from 'node:fs';
import path from 'node:path';
import { normalizePaperId, isPublishedArticle, articleDetail, object } from '../long-covid/article-detail';
import { parseCSV } from '@/app/birds-eye-reviews/long-covid/screening/csv-utils';
import { publicationFor } from '../long-covid/publications-server';
export type ReviewSlug = 'long-covid' | 'me-cfs';
export function reviewDataPath(review: ReviewSlug, name = ''): string {
 const root = review === 'me-cfs' ? process.env.ME_CFS_DATA_DIR : process.env.LONG_COVID_DATA_DIR;
 return path.join(root || path.join(process.cwd(), 'data/birds_eye_reviews', review.replaceAll('-', '_')), name);
}
export function reviewVersion(review: ReviewSlug): string {
 const value = JSON.parse(fs.readFileSync(reviewDataPath(review, 'last_updated.json'), 'utf8'));
 return value.release_version || value.generated_at_utc || value.last_updated;
}
const caches = new Map<string, {version: string; stamp: string; records: Map<string, Record<string, unknown>>}>();
export function reviewArticles(review: ReviewSlug) {
 const version = reviewVersion(review), dir = reviewDataPath(review);
 const names = ['trial_extractions.jsonl', review === 'long-covid' ? 'long_covid_prevention_trials.jsonl' : 'prevention_trials.jsonl', 'trial_screening.csv'];
 const stamp = names.map(name => { const p=path.join(dir,name); return fs.existsSync(p) ? `${name}:${fs.statSync(p).mtimeMs}:${fs.statSync(p).size}` : name; }).join('|');
 const prior = caches.get(dir); if (prior?.version === version && prior.stamp === stamp) return prior;
 const excluded = new Set<string>(), csvPath = path.join(dir, 'trial_screening.csv');
 if (fs.existsSync(csvPath)) {
  const csv=parseCSV(fs.readFileSync(csvPath,'utf8')), headers=csv.shift() || [], di=headers.indexOf('doi'), ei=headers.indexOf('is_excluded');
  for (const row of csv) if (row[ei]?.trim().toLowerCase()==='yes') excluded.add(normalizePaperId(row[di] || '').split('#')[0]);
 }
 const records = new Map<string, Record<string, unknown>>();
 for (const name of names.slice(0,2)) {
  const file=path.join(dir,name); if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file,'utf8').split('\n').filter(line=>line.trim())) {
   const record=JSON.parse(line) as Record<string,unknown>;
   if (isPublishedArticle(record, excluded) && (review !== 'me-cfs' || record._status === 'ok')) records.set(normalizePaperId(String(record.paper_id)),record);
  }
 }
 const result={version,stamp,records}; caches.set(dir,result); return result;
}
export function reviewArticle(review: ReviewSlug, id: string) {
 const {version,records}=reviewArticles(review), record=records.get(normalizePaperId(id));
 if (!record) return null;
 let projected=record;
 if (review==='me-cfs') {
  const {long_covid_definition,long_covid_definition_source,...population}=object(record.participants);
  projected={...record,participants:{...population,condition_definition:population.condition_definition??long_covid_definition,condition_definition_source:population.condition_definition_source??long_covid_definition_source}};
 }
 return articleDetail(projected,version,publicationFor(String(record.paper_id).split('#')[0],reviewDataPath(review,'publication_metadata.json')));
}
