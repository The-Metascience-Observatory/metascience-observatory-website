import {test,expect} from '@playwright/test';
test('treatment details, switching, keyboard close, cache and public endpoint',async({page,request})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/birds-eye-reviews/long-covid?who=0&below=1');
 const refs=page.getByRole('button',{name:/View article:/});await expect(refs.first()).toBeVisible();
 await refs.first().click();const panel=page.getByTestId('article-panel');await expect(panel.getByText('PICO breakdown')).toBeVisible();await expect(panel.getByText('Population',{exact:true})).toBeVisible();
 await page.screenshot({path:'test-results-long-covid/long-covid-desktop-panel.png',fullPage:false});
 await refs.nth(1).click();await expect(panel.getByText('PICO breakdown')).toBeVisible();await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);
 await refs.first().focus();await page.keyboard.press('Enter');await expect(panel).toBeVisible();await page.getByRole('button',{name:'Close article details'}).click();await expect(refs.first()).toBeFocused();
 expect((await request.get('/api/long-covid/article?id=not-published')).status()).toBe(404);
 expect((await request.get('/api/long-covid/article')).status()).toBe(400);
 expect(errors).toEqual([]);
 await page.screenshot({path:'test-results-long-covid/long-covid-table.png',fullPage:false});
});
test('prevention panel is a mobile dialog with readable reference and PICO',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/birds-eye-reviews/long-covid/prevention');
 await page.locator('tbody button').first().click();const panel=page.getByTestId('article-panel');await expect(panel).toHaveAttribute('aria-modal','true');await expect(panel.getByText('PICO breakdown')).toBeVisible();await expect(panel.getByRole('link',{name:'Publisher',exact:false})).toBeVisible();
 await page.screenshot({path:'test-results-long-covid/long-covid-mobile-panel.png',fullPage:false});
 await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);
});

test('failed detail request can be retried without resetting the table',async({page})=>{
 let fail=true;
 await page.route('**/api/long-covid/article?**',async route=>{if(fail)await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary detail failure'})});else await route.continue();});
 await page.goto('/birds-eye-reviews/long-covid?who=0&below=1');
 const refs=page.getByRole('button',{name:/View article:/});await refs.first().click();
 await expect(page.getByTestId('article-panel').getByRole('alert')).toContainText('Temporary detail failure');
 fail=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByTestId('article-panel').getByText('PICO breakdown')).toBeVisible();
 const url=page.url();await page.keyboard.press('Escape');expect(page.url()).toBe(url);await expect(refs.first()).toBeFocused();
});
