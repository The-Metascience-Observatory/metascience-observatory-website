/** Shared by server loaders and client filters. No network or filesystem access. */
export type MedlineStatus = 'yes' | 'no' | 'unknown' | 'not_applicable';
export type PublicationStatus = 'peer_reviewed' | 'preprint_only' | 'linked_preprint' | 'journal_published' | 'journal_unverified' | 'other' | 'unknown';
export interface PublicationMetadata {
  doi: string;
  originalJournal?: string;
  journalTitle?: string;
  nlmId?: string | null;
  issns?: string[];
  medline: MedlineStatus;
  publication: PublicationStatus;
  publishedDois: string[];
  preprintDois?: string[];
  matchMethod?: string;
  checkedAt?: string | null;
  publicationCheckedAt?: string | null;
  medlineCheckedAt?: string;
  sources?: string[];
  reviewNote?: string;
  indexingEvidence?: string;
}
export type MedlineFilter = 'all' | MedlineStatus;
export type PublicationFilter = 'all' | 'journal_published' | 'preprint_only' | 'other';
export const medlineOptions: [MedlineFilter, string][] = [['all','All journals'],['yes','Currently MEDLINE-indexed only'],['no','Confirmed not currently indexed'],['unknown','Indexing unknown'],['not_applicable','Not a journal / preprint']];
export const publicationOptions: [PublicationFilter, string][] = [['all','All publication statuses'],['journal_published','Peer-reviewed only'],['preprint_only','Preprint-only'],['other','Other or unverified']];
export const parseMedline = (s: string | null): MedlineFilter => medlineOptions.some(([v])=>v===s) ? s as MedlineFilter : 'all';
// Preserve old shared links while removing the manual-review whitelist gate.
export const parsePublication = (s: string | null): PublicationFilter => s === 'peer_reviewed' ? 'journal_published' : publicationOptions.some(([v])=>v===s) ? s as PublicationFilter : 'all';
export const isJournalPublished = (status: PublicationStatus) => ['journal_published','journal_unverified','peer_reviewed'].includes(status);
export const baseDoi = (s: string) => s.trim().replace(/^https?:\/\/(dx\.)?doi.org\//i,'').split('#')[0].toLowerCase();
export function matchesPublication(meta: PublicationMetadata | undefined, medline: MedlineFilter, publication: PublicationFilter) {
  if (medline !== 'all' && (meta?.medline ?? 'unknown') !== medline) return false;
  const status = meta?.publication ?? 'unknown';
  if (publication === 'all') return true;
  if (publication === 'journal_published') return isJournalPublished(status);
  if (publication === 'other') return !isJournalPublished(status) && status !== 'preprint_only';
  return status === 'preprint_only';
}
/** Only replace a preprint if its published extraction is in this eligible view.
 * Preserve arm splits; never combine distinct reports merely sharing a trial. */
export function preferPublished<T extends { paper_id: string; publicationMetadata?: PublicationMetadata }>(rows: T[]): T[] {
  const published = new Set(rows.filter(r=>!['linked_preprint','preprint_only'].includes(r.publicationMetadata?.publication ?? 'unknown')).map(r=>baseDoi(r.paper_id)));
  return rows.filter(r=>r.publicationMetadata?.publication !== 'linked_preprint' || !(r.publicationMetadata.publishedDois ?? []).some(d=>baseDoi(d)!==baseDoi(r.paper_id) && published.has(baseDoi(d))));
}
export function metadataCounts<T extends {publicationMetadata?: PublicationMetadata}>(rows:T[], medline:MedlineFilter, publication:PublicationFilter) {
  return {
    medline: Object.fromEntries(medlineOptions.map(([v])=>[v,rows.filter(r=>matchesPublication(r.publicationMetadata,v,publication)).length])),
    publication:Object.fromEntries(publicationOptions.map(([v])=>[v,rows.filter(r=>matchesPublication(r.publicationMetadata,medline,v)).length])),
  };
}
