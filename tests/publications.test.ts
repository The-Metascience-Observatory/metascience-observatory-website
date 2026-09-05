import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesPublication, preferPublished, metadataCounts, baseDoi, parseMedline, parsePublication, type PublicationMetadata } from '../lib/long-covid/publications';
const meta=(publication:PublicationMetadata['publication'],medline:PublicationMetadata['medline']='unknown',publishedDois:string[]=[]):PublicationMetadata=>({doi:'10.test/a',publication,medline,publishedDois});
test('unknowns remain visible in All but cannot pass verified filters',()=>{
 assert(matchesPublication(undefined,'all','all'));
 assert(matchesPublication(undefined,'unknown','other'));
 assert(!matchesPublication(undefined,'yes','all'));
 assert(matchesPublication(meta('journal_unverified','yes'),'all','journal_published'));
});
test('indexing and publication filters intersect independently',()=>{
 assert(matchesPublication(meta('peer_reviewed','no'),'no','journal_published'));
 assert(!matchesPublication(meta('peer_reviewed','no'),'yes','journal_published'));
 assert(!matchesPublication(meta('preprint_only'),'yes','preprint_only'));
});
test('published version preference applies only to available counterparts',()=>{
 const pre={paper_id:'10.test/pre',publicationMetadata:meta('linked_preprint','unknown',['10.test/pub'])};
 const pub={paper_id:'10.test/pub',publicationMetadata:meta('peer_reviewed','yes')};
 assert.deepEqual(preferPublished([pre]),[pre]);
 assert.deepEqual(preferPublished([pre,pub]),[pub]);
 assert.deepEqual(preferPublished([pre,{...pub,paper_id:'10.test/pub#arm1'},{...pub,paper_id:'10.test/pub#arm2'}]).map(x=>x.paper_id),['10.test/pub#arm1','10.test/pub#arm2']);
 assert(!matchesPublication(pre.publicationMetadata,'all','preprint_only'));
 assert(!matchesPublication(pre.publicationMetadata,'all','journal_published'));
});
test('cyclic or same DOI links do not erase evidence',()=>{
 const a={paper_id:'10.test/a',publicationMetadata:meta('linked_preprint','unknown',['10.test/b'])};
 const b={paper_id:'10.test/b',publicationMetadata:meta('linked_preprint','unknown',['10.test/a'])};
 assert.equal(preferPublished([a,b]).length,2);
});
test('facet counts respect the other selection',()=>{
 const rows=[{publicationMetadata:meta('peer_reviewed','yes')},{publicationMetadata:meta('preprint_only')},{publicationMetadata:meta('journal_unverified','yes')}];
 const c=metadataCounts(rows,'yes','journal_published');assert.equal(c.medline.all,2);assert.equal(c.publication.all,2);assert.equal(c.publication.preprint_only,0);
});
test('URL values and DOI formats normalize safely',()=>{
 assert.equal(baseDoi('https://doi.org/10.TEST/A#arm'),'10.test/a');
 assert.equal(parseMedline('bad'),'all');assert.equal(parsePublication('bad'),'all');
 assert.equal(parsePublication('preprint_only'),'preprint_only');
 assert.equal(parsePublication('peer_reviewed'),'journal_published');
});

test('exported metadata preserves verified/unknown distinctions',async()=>{
 const {readFileSync}=await import('node:fs');
 const d=JSON.parse(readFileSync('data/birds_eye_reviews/long_covid/publication_metadata.json','utf8'));
 assert.equal(d.version,1);assert(d.nlmCount>5000);
 for(const m of Object.values(d.papers) as PublicationMetadata[]) {
  if(m.medline==='yes') assert(m.nlmId);
  if(m.medline==='no') assert(m.nlmId || (m.matchMethod==='doi_issns_absent_from_nlm' && m.indexingEvidence && m.issns?.length));
  if(m.publication==='peer_reviewed') {assert(m.reviewNote);assert(m.sources?.length);}
  if(m.publication==='preprint_only') {assert.equal(m.publishedDois.length,0);assert(m.publicationCheckedAt);assert.notEqual(m.medline,'yes');}
  if(m.publication==='linked_preprint') assert(m.publishedDois.length>0);
 }
});

test('all confirmed journal publications pass regardless of manual-review coverage',()=>{
 for(const status of ['journal_published','journal_unverified','peer_reviewed'] as const) {
  assert(matchesPublication(meta(status),'all','journal_published'));
  assert(!matchesPublication(meta(status),'all','other'));
 }
 for(const status of ['preprint_only','linked_preprint','other','unknown'] as const) {
  assert(!matchesPublication(meta(status),'all','journal_published'));
 }
});
