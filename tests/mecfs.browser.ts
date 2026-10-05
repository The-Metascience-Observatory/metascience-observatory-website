import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const releaseReportCount=readFileSync(path.join(process.cwd(),'data/birds_eye_reviews/me_cfs/trial_extractions.jsonl'),'utf8').trim().split('\n').length;
test('ME/CFS dashboard scopes filters, details, and diagnostic criteria',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/birds-eye-reviews/me-cfs?inspect=synthesis');
 await expect(page.getByRole('heading',{name:'ME/CFS Treatment Evidence',exact:true})).toBeVisible();
 await expect(page.getByLabel('INSPECT-SR review filter')).toHaveCount(0);
 await expect(page.getByText('No assessment snapshot available.')).toHaveCount(0);
 await expect(page).not.toHaveURL(/inspect=/);
 const root=page.getByTestId('treatment-dashboard');
 await expect(root).toHaveAttribute('data-filters-ready','true');
 // The linked Research Square preprint is suppressed while its journal report is present.
 await expect(root).toHaveAttribute('data-selected-reports',String(releaseReportCount-1));
 await expect(page.getByRole('link',{name:/View graded-exercise/})).toHaveAttribute('href','/birds-eye-reviews/me-cfs/graded-exercise-therapy');
 await expect(page.getByText('WHO-aligned', {exact:false})).toHaveCount(0);
 const criteria=page.getByLabel('ME/CFS diagnostic criteria');
 await criteria.selectOption('CDC / Fukuda 1994');
 await expect(page).toHaveURL(/criteria=/);
 const n=Number(await root.getAttribute('data-selected-reports'));
 expect(n).toBeGreaterThan(0);expect(n).toBeLessThan(releaseReportCount-1);
 await page.reload();await expect(criteria).toHaveValue('CDC / Fukuda 1994');
 await criteria.selectOption('');
 const article=page.getByRole('button',{name:/^View article:/}).first();
 await expect(article).toBeEnabled();
 const response=page.waitForResponse(r=>r.url().includes('/api/me-cfs/article?'));
 await article.click();expect((await response).status()).toBe(200);
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('heading',{name:'PICO breakdown'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Adverse events and harms'})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(errors).toEqual([]);
 await page.screenshot({path:'/tmp/me-cfs-dashboard-desktop.png',fullPage:false});
});
test('ME/CFS screening and preserved graded-exercise analysis render on mobile',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});
 await page.goto('/birds-eye-reviews/me-cfs/screening');
 await expect(page.getByRole('heading',{name:'ME/CFS Trial Screening'})).toBeVisible();
 await expect(page.getByText(/All screened ME\/CFS records remain available/)).toBeVisible();
 await expect(page.locator('tbody tr').first()).toBeVisible();
 await expect(page.getByLabel('Journal indexing',{exact:true})).toHaveValue('all');
 await page.getByLabel('Publication status',{exact:true}).selectOption('preprint_only');
 await expect(page).toHaveURL(/publication=preprint_only/);
 await page.goto('/birds-eye-reviews/me-cfs/graded-exercise-therapy');
 await expect(page.getByRole('heading',{name:'Graded Exercise Therapy for ME/CFS',exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});
test('article APIs isolate reviews and reject stale versions and scope-held records',async({request})=>{
 const held=await request.get('/api/me-cfs/article?id=10.1086/320530');expect(held.status()).toBe(404);
 const stale=await request.get('/api/me-cfs/article?id=10.1001/archinte.158.8.908&version=old');expect(stale.status()).toBe(409);
 const valid=await request.get('/api/me-cfs/article?id=10.1001/archinte.158.8.908');expect(valid.status()).toBe(200);
 const body=await valid.json();expect(body.releaseVersion).toMatch(/^me-cfs-preview-/);expect(body.reference.title).not.toBe(body.paperId);
 expect(JSON.stringify(body)).not.toMatch(/\/home\/dan|\/media\/dan|_source_findings|_unmerged_extractions/);
 const lc=await request.get('/birds-eye-reviews/long-covid');expect(lc.status()).toBe(200);expect(await lc.text()).toContain('Long Covid Clinical Trials');
});

test('ME/CFS screening filters the full corpus and downloads its own citations',async({request})=>{
 const all=await (await request.get('/api/me-cfs/screening?limit=1')).json();
 expect(all.total).toBeGreaterThan(10000);expect(all.rows).toHaveLength(1);
 const indexed=await (await request.get('/api/me-cfs/screening?medline=yes&limit=1')).json();
 expect(indexed.total).toBeGreaterThan(0);expect(indexed.total).toBeLessThan(all.total);
 expect(indexed.rows).toHaveLength(1);expect(indexed.rows[0].publicationMetadata.medline).toBe('yes');
 const unknown=await (await request.get('/api/me-cfs/screening?medline=unknown&limit=1')).json();
 expect(unknown.total).toBeGreaterThan(0);expect(unknown.rows[0].publicationMetadata.medline).toBe('unknown');
 const csv=await request.get('/api/me-cfs/screening/download');expect(csv.status()).toBe(200);
 expect(csv.headers()['content-disposition']).toContain('me_cfs_screening.csv');expect(await csv.text()).toContain('paper_title');
});


test('reviewed pooled results are inspectable while synthesis stays held',async({page,request})=>{
 const response=await request.get('/api/me-cfs/article?id=10.1111/bjhp.12711');expect(response.status()).toBe(200);
 const detail=await response.json();expect(detail.outcomes[0].additionalResults.pooled_adjusted_changes[0].estimate).toBe(-4.14);
 expect(detail.verifiedFindings).toBeNull();expect(detail.reviewNotice).toContain('review pending');
 await page.goto('/birds-eye-reviews/me-cfs');
 await page.getByPlaceholder('Intervention, DOI, country...').fill('10.1111/bjhp.12711');
 await page.getByRole('button',{name:/^View article:/}).click();
 const panel=page.getByRole('dialog');await expect(panel).toBeVisible();
 await panel.locator('details').first().locator('summary').click();
 await expect(panel.getByRole('heading',{name:'Additional reported results and context'}).first()).toBeVisible();
 await expect(panel.getByText('Pooled adjusted changes:',{exact:true}).first()).toBeVisible();
 await expect(panel.getByTestId('article-review-notice')).toContainText('not approved for synthesis');
});
