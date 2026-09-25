import { longCovidDataPath } from "./data-path";
import fs from 'node:fs';
import path from 'node:path';
import { normalizePaperId, isPublishedArticle, articleDetail } from './article-detail';
import { parseCSV } from '@/app/birds-eye-reviews/long-covid/screening/csv-utils';
import { publicationFor } from './publications-server';
const dir=longCovidDataPath();
function read(name:string){return fs.readFileSync(path.join(dir,name),'utf8');}
export function releaseVersion():string {const v=JSON.parse(read('last_updated.json'));return v.release_version || v.generated_at_utc || v.last_updated;}
let cache:{version:string;records:Map<string,Record<string,unknown>>}|undefined;
export function publishedArticles(){
 const version=releaseVersion();if(cache?.version===version)return cache;
 const excluded=new Set<string>();const csv=parseCSV(read('trial_screening.csv'));const headers=csv.shift()||[];const di=headers.indexOf('doi'),ei=headers.indexOf('is_excluded');
 for(const row of csv)if(row[ei]?.trim().toLowerCase()==='yes')excluded.add(normalizePaperId(row[di]||'').split('#')[0]);
 const records=new Map<string,Record<string,unknown>>();
 for(const name of ['trial_extractions.jsonl','long_covid_prevention_trials.jsonl']){
  if(!fs.existsSync(path.join(dir,name)))continue;
  for(const line of read(name).split('\n').filter(Boolean)){const r=JSON.parse(line) as Record<string,unknown>;if(isPublishedArticle(r,excluded))records.set(normalizePaperId(String(r.paper_id)),r);}
 }
 cache={version,records};return cache;
}
export function publicArticle(id:string){const {version,records}=publishedArticles();const r=records.get(normalizePaperId(id));return r?articleDetail(r,version,publicationFor(String(r.paper_id).split('#')[0])):null;}
