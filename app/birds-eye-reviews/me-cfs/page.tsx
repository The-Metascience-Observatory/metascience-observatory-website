import fs from 'node:fs';
import { loadReviewDashboardData } from '@/lib/birds-eye-reviews/dashboard-data';
import { reviewDataPath } from '@/lib/birds-eye-reviews/data';
import { BirdsEyeNavbar } from '@/components/BirdsEyeNavbar';
import { Footer } from '@/components/Footer';
import { LongCovidDashboard } from '../long-covid/LongCovidDashboard';
export const metadata={title:"ME/CFS Treatment Evidence | Bird's Eye Reviews | The Metascience Observatory",description:'Clinical trials and observational evidence on ME/CFS treatments, with source details, screening history and evidence-quality information.'};
export default function MeCfsReviewPage(){
 const data=loadReviewDashboardData('me-cfs');
 const preview=fs.existsSync(reviewDataPath('me-cfs','PREVIEW_STATUS.json'));
 return <><BirdsEyeNavbar subtitle="ME/CFS"/><main className="pt-20 pb-16"><div className="container mx-auto px-2 py-8 max-w-7xl"><LongCovidDashboard {...data} review={{slug:'me-cfs',label:'ME/CFS',preview}}/></div></main><Footer/></>;
}
