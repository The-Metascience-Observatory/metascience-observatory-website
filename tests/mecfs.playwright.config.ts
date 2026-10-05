import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:['mecfs.browser.ts','publications.browser.ts'],workers:1,timeout:120000,use:{baseURL:'http://127.0.0.1:3418',headless:true},webServer:{command:'npx next dev --port 3418',cwd:process.cwd(),url:'http://127.0.0.1:3418/birds-eye-reviews/me-cfs',timeout:180000,reuseExistingServer:false},reporter:'list'});
