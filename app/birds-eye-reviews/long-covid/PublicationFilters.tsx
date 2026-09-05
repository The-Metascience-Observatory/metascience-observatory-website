'use client';
import { useEffect, useState, useId } from 'react';
import { medlineOptions, publicationOptions, parseMedline, parsePublication, type MedlineFilter, type PublicationFilter, type PublicationMetadata } from '@/lib/long-covid/publications';
export function usePublicationFilters(syncUrl=true) {
  const [medline,setMedline]=useState<MedlineFilter>('all');
  const [publication,setPublication]=useState<PublicationFilter>('all');
  const [ready,setReady]=useState(false);
  useEffect(()=>{const p=new URLSearchParams(window.location.search);setMedline(parseMedline(p.get('medline')));setPublication(parsePublication(p.get('publication')));setReady(true);},[]);
  useEffect(()=>{
    if(!ready || !syncUrl)return;
    const p=new URLSearchParams(window.location.search);
    medline==='all'?p.delete('medline'):p.set('medline',medline);
    publication==='all'?p.delete('publication'):p.set('publication',publication);
    window.history.replaceState(window.history.state,'',window.location.pathname+(p.size?'?'+p.toString():'')+window.location.hash);
  },[medline,publication,ready,syncUrl]);
  return {medline,setMedline,publication,setPublication,ready};
}
export function PublicationFilters({medline,setMedline,publication,setPublication,counts}:{
 medline:MedlineFilter;setMedline:(v:MedlineFilter)=>void;publication:PublicationFilter;setPublication:(v:PublicationFilter)=>void;
 counts?:{medline:Record<string,number>;publication:Record<string,number>};checkedAt?:string;
}) {
 const publicationId=useId();
 const publicationHelp="Preprint-only means no published version was found at the last check. For this filter, confirmed journal publication is treated as peer-reviewed.";
 return <section aria-label="Publication and journal filters" className="mb-4 rounded-lg border border-border bg-foreground/[0.07] p-4 space-y-3">
  <div className="flex items-start justify-between gap-3">
   <span className="text-sm font-medium text-foreground">Filter by publication and journal</span>
   <button type="button" className="shrink-0 text-xs text-blue-600 hover:text-blue-700" onClick={()=>{setMedline('all');setPublication('all');}}>Reset publication filters</button>
  </div>
  <div className="flex flex-wrap gap-4 items-end">
   <div className="text-sm"><label htmlFor={publicationId}>Publication status</label><button type="button" title={publicationHelp} aria-label={publicationHelp} className="ml-1 text-foreground/60 hover:text-foreground focus-visible:outline focus-visible:outline-2">[?]</button><select id={publicationId} aria-label="Publication status" className="block mt-1 border rounded p-2 bg-background max-w-full" value={publication} onChange={e=>setPublication(parsePublication(e.target.value))}>{publicationOptions.map(([v,l])=><option key={v} value={v}>{l}{counts?` (${counts.publication[v] ?? 0})`:''}</option>)}</select></div>
   <label className="text-sm">Journal indexing<select aria-label="Journal indexing" className="block mt-1 border rounded p-2 bg-background max-w-full" value={medline} onChange={e=>setMedline(parseMedline(e.target.value))}>{medlineOptions.map(([v,l])=><option key={v} value={v}>{l}{counts?` (${counts.medline[v] ?? 0})`:''}</option>)}</select></label>
  </div>
 </section>;
}
export function PublicationDetails({meta}:{meta?:PublicationMetadata}) {
 if(!meta)return <span className="text-xs text-foreground/50">Publication/indexing not checked</span>;
 const status={peer_reviewed:'Journal-published',preprint_only:'Preprint; no published version known',linked_preprint:'Published version found; preprint extraction shown',journal_published:'Journal-published',journal_unverified:'Journal-published',other:'Other publication',unknown:'Publication status unverified'}[meta.publication];
 return <details onClick={e=>e.stopPropagation()} className="text-xs my-1 text-foreground/70"><summary className="cursor-pointer">{status} · {meta.medline==='yes'?'MEDLINE journal':meta.medline==='no'?'Not currently MEDLINE-indexed':meta.medline==='not_applicable'?'Journal indexing not applicable':'Indexing unknown'}</summary>
 <div className="space-y-1 pl-2 mt-1"><p>{meta.journalTitle || meta.originalJournal || 'Journal unknown'}</p>{meta.originalJournal && meta.originalJournal!==meta.journalTitle && <p>Recorded name: {meta.originalJournal}</p>}
 <p>Match: {meta.matchMethod || 'unresolved'}; indexing snapshot: {meta.medlineCheckedAt || 'unknown'}. Publication checked: {meta.publicationCheckedAt || meta.checkedAt || 'unknown'}.</p>
 {meta.indexingEvidence && <p>{meta.indexingEvidence}</p>}
 {meta.reviewNote && <p>{meta.reviewNote}</p>}
 {meta.nlmId && <a className="block underline" href={`https://www.ncbi.nlm.nih.gov/nlmcatalog/?term=${encodeURIComponent(meta.nlmId+'[NLM Unique ID]')}`} target="_blank" rel="noreferrer">NLM journal record</a>}
 {meta.publishedDois.map(d=><a className="block underline" key={d} href={`https://doi.org/${d}`} target="_blank" rel="noreferrer">Published version: {d}</a>)}
 {meta.preprintDois?.map(d=><a className="block underline" key={d} href={`https://doi.org/${d}`} target="_blank" rel="noreferrer">Earlier preprint: {d}</a>)}
 {meta.sources?.map(s=><a key={s} className="block underline break-all" href={s} target="_blank" rel="noreferrer">Verification source</a>)}
 </div></details>;
}
