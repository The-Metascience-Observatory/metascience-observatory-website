import fs from 'fs';
import path from 'path';
import { baseDoi, type PublicationMetadata } from './publications';
let cache: Record<string, PublicationMetadata> | undefined;
let modifiedAt = -1;
let lastChecked = 0;
export function publicationFor(doi: string): PublicationMetadata | undefined {
  // Enrichment can replace the snapshot while local preview is running.
  // Check once per second, not once for every row; parse only changed snapshots.
  if (!cache || Date.now() - lastChecked > 1000) {
    const filename=path.join(process.cwd(),'data/birds_eye_reviews/long_covid/publication_metadata.json');
    lastChecked=Date.now();
    if (!fs.existsSync(filename)) return cache?.[baseDoi(doi)];
    const mtime=fs.statSync(filename).mtimeMs;
    if (mtime !== modifiedAt) {
      const data=JSON.parse(fs.readFileSync(filename,'utf8'));
      if (data.version !== 1 || !data.papers) throw new Error('Unsupported publication metadata snapshot');
      cache=data.papers;
      modifiedAt=mtime;
    }
  }
  return cache?.[baseDoi(doi)];
}
