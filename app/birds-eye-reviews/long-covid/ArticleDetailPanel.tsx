'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ExternalLink } from 'lucide-react';
import type { ArticleDetail, DetailValue } from '@/lib/long-covid/article-detail';
const label=(s:string)=>s.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
function Values({value}:{value:DetailValue}){
 if(value==null || (Array.isArray(value)&&!value.length))return <span className="text-muted-foreground">Not reported</span>;
 if(Array.isArray(value))return <div className="space-y-3">{value.map((v,i)=><div key={i} className="border-l-2 border-border pl-3"><Values value={v}/></div>)}</div>;
 if(typeof value==='object')return <dl className="space-y-1">{Object.entries(value).filter(([,v])=>v!=null && v!=='' && (!Array.isArray(v)||v.length)).map(([k,v])=><div key={k} className="break-words"><dt className="inline font-medium">{label(k)}: </dt><dd className="inline"><Values value={v}/></dd></div>)}</dl>;
 return <>{typeof value==='boolean'?(value?'Yes':'No'):String(value)}</>;
}
export function ArticleDetailPanel({paperId,version,onClose}:{paperId:string;version:string;onClose:()=>void}){
 const panel=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null),returnTo=useRef<HTMLElement|null>(null);
 const [mobile,setMobile]=useState(false);
 const {data,error,isPending,refetch}=useQuery<ArticleDetail>({queryKey:['long-covid-article',version,paperId],queryFn:async({signal})=>{const r=await fetch(`/api/long-covid/article?${new URLSearchParams({id:paperId,version})}`,{signal});if(!r.ok){const body=await r.json();throw new Error(body.error||'Unable to load article');}return r.json();},staleTime:300000,retry:1});
 useEffect(()=>{const mq=window.matchMedia('(max-width: 767px)');const change=()=>setMobile(mq.matches);change();mq.addEventListener('change',change);return()=>mq.removeEventListener('change',change);},[]);
 useEffect(()=>{returnTo.current=document.activeElement as HTMLElement;close.current?.focus();return()=>{if(returnTo.current?.isConnected)returnTo.current.focus();};},[]);
 useEffect(()=>{panel.current?.scrollTo(0,0);},[paperId]);
 useEffect(()=>{const previous=document.body.style.overflow;if(mobile)document.body.style.overflow='hidden';return()=>{if(mobile)document.body.style.overflow=previous;};},[mobile]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose();}if(mobile&&e.key==='Tab'){const nodes=Array.from(panel.current?.querySelectorAll<HTMLElement>('button,a[href],summary,[tabindex="0"]')||[]).filter(node=>node.getClientRects().length>0);if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[mobile,onClose]);
 return <aside ref={panel} role="dialog" aria-modal={mobile || undefined} aria-labelledby="article-panel-title" className="fixed inset-y-0 right-0 z-50 w-full md:w-[min(38rem,55vw)] overflow-y-auto border-l border-border bg-background text-foreground shadow-2xl" data-testid="article-panel">
  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-5 py-3"><h2 id="article-panel-title" className="font-semibold">Article details</h2><button ref={close} onClick={onClose} aria-label="Close article details" className="rounded p-2 hover:bg-muted"><X size={20}/></button></div>
  <div className="space-y-6 p-5 text-sm">
   {isPending&&<p role="status">Loading article…</p>}
   {error&&<div role="alert"><p>{error.message}</p><button className="mt-2 underline" onClick={()=>refetch()}>Retry</button></div>}
   {data&&<>
    <section><h3 className="text-xl font-semibold leading-snug">{data.reference.title}</h3><p className="mt-3">{data.reference.authors||'Authors not reported'}</p><p className="text-muted-foreground">{[data.reference.journal,data.reference.year,data.reference.volume,data.reference.issue&&`(${data.reference.issue})`,data.reference.pages].filter(Boolean).join(' · ')}</p><p className="mt-1 break-all">{data.paperId}</p><div className="mt-3 flex flex-wrap gap-4">{data.reference.doiUrl&&<a href={data.reference.doiUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">Publisher <ExternalLink size={12}/></a>}<a href={data.reference.explorerUrl} target="_blank" rel="noopener noreferrer" className="underline">Metascience Explorer</a></div></section>
    <section className="rounded border border-border bg-muted/30 p-3"><p>{label(data.design)} · N: {data.participantCount??'Not reported'} · Risk of bias: {label(data.riskOfBias)}</p><p className="mt-2 font-medium">{data.completeness}</p><p className="text-xs text-muted-foreground">Missing results are not evidence of no effect. AI-extracted information should be checked against the publication.</p></section>
    <section><h3 className="mb-3 text-lg font-semibold">PICO breakdown</h3><dl className="space-y-4">{[['Population',data.population],['Intervention',data.interventions],['Comparator',data.comparators.length?data.comparators:data.comparatorStatus]] .map(([name,value])=><div key={String(name)}><dt className="mb-1 font-semibold">{String(name)}</dt><dd><Values value={value as DetailValue}/></dd></div>)}<div><dt className="font-semibold">Outcomes</dt><dd>{data.outcomes.length?<ul className="list-disc pl-5">{data.outcomes.map((o,i)=><li key={i}>{o.name} {o.primary===true?'(primary)':o.primary===false?'(secondary)':''}</li>)}</ul>:'Not reported'}</dd></div></dl></section>
    <section><h3 className="mb-2 text-lg font-semibold">Outcome results</h3>{!data.outcomes.length&&<p>No outcomes were extracted. This paper remains visible because missing data alone is not an exclusion.</p>}{data.outcomes.map((o,i)=><details key={`${data.paperId}-${i}`} className="border-b border-border py-3"><summary className="cursor-pointer font-medium">{o.name}</summary><div className="mt-3 space-y-4"><p>{[o.instrument,o.domain,o.units].filter(Boolean).join(' · ')}</p>{[['Timepoints',o.timepoints],['Per-arm results',o.armResults],['Between-group comparisons',o.betweenGroupEffects],['Within-group changes',o.withinGroupChanges]].map(([title,value])=><section key={String(title)}><h4 className="mb-1 font-semibold">{String(title)}</h4><Values value={value as DetailValue}/></section>)}</div></details>)}</section>
    {data.verifiedFindings && <section><h3 className="mb-2 font-semibold">Source-verified findings</h3><Values value={data.verifiedFindings}/></section>}
    <details><summary className="cursor-pointer font-semibold">Publication and indexing</summary><div className="mt-2"><Values value={data.publication}/></div></details>
    <section><h3 className="mb-2 font-semibold">Provenance and limitations</h3><Values value={data.provenance}/><div className="mt-3"><Values value={data.limitations}/></div></section>
   </>}
  </div>
 </aside>;
}
