import { longCovidDataPath } from "@/lib/long-covid/data-path";
import fs from 'fs';
import path from 'path';
import { baseDoi, type PublicationMetadata } from './publications';
const caches = new Map<string, {papers: Record<string, PublicationMetadata>; modifiedAt: number; checkedAt: number}>();
export function publicationFor(doi: string, filename = longCovidDataPath('publication_metadata.json')): PublicationMetadata | undefined {
 let snapshot=caches.get(filename);
 if (!snapshot || Date.now()-snapshot.checkedAt>1000) {
  if (!fs.existsSync(filename)) { caches.delete(filename); return undefined; }
  const mtime=fs.statSync(filename).mtimeMs;
  if (!snapshot || snapshot.modifiedAt!==mtime) {
   const data=JSON.parse(fs.readFileSync(filename,'utf8'));
   if (data.version!==1 || !data.papers) throw new Error('Unsupported publication metadata snapshot');
   snapshot={papers:data.papers,modifiedAt:mtime,checkedAt:Date.now()};
  } else snapshot.checkedAt=Date.now();
  caches.set(filename,snapshot);
 }
 return snapshot?.papers[baseDoi(doi)];
}
