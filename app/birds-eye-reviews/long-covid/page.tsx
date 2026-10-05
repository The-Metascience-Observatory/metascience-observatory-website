import { loadReviewDashboardData } from '@/lib/birds-eye-reviews/dashboard-data';
import { BirdsEyeNavbar } from '@/components/BirdsEyeNavbar';
import { Footer } from '@/components/Footer';
import { LongCovidDashboard } from './LongCovidDashboard';
export const metadata = {
  title: "Long Covid Clinical Trials | Bird's Eye Reviews | The Metascience Observatory",
  description:
    "Interactive dashboard of clinical trials on Long Covid interventions — evidence landscape, effect sizes, metascience analysis, and trial-level detail.",
};


export default function LongCovidReviewPage() {
  let data;
  try {
    data = loadReviewDashboardData("long-covid");
  } catch (err) {
    console.error("Failed to load Long Covid data:", err);
    return (
      <div className="min-h-screen">
        <BirdsEyeNavbar subtitle="Long Covid" />
        <main className="pt-20 pb-16">
          <div className="container mx-auto px-4 py-12 max-w-7xl text-center">
            <h1 className="text-2xl font-bold mb-4">Data Unavailable</h1>
            <p className="text-muted-foreground">
              The Long Covid trial data could not be loaded. Please try again later.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <BirdsEyeNavbar subtitle="Long Covid" />
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-2 py-8 max-w-7xl">
          <LongCovidDashboard {...data} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
