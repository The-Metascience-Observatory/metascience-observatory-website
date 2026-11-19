import { BoardOfDirectors } from "@/components/BoardOfDirectors";
import { AdvisoryBoard } from "@/components/AdvisoryBoard";

/** Board of Directors and Metascientific Advisory Board. */
export const Boards = () => {
  return (
    <div className="py-8">
      <div className="container px-4">
        {/* Side by side from md up; the cards stretch to the taller one so their bottoms line up. */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-8">
          <BoardOfDirectors />
          <AdvisoryBoard />
        </div>
      </div>
    </div>
  );
};
