import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'.',outputDir:'test-results-long-covid',testMatch:'article-panel.browser.ts',workers:1,timeout:120000,use:{baseURL:'http://127.0.0.1:3417',headless:true},reporter:'list'});
