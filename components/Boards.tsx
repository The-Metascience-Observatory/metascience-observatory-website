import { BoardOfDirectors } from "@/components/BoardOfDirectors";
import { AdvisoryBoard } from "@/components/AdvisoryBoard";

/** Board of Directors and Metascientific Advisory Board. */
export const Boards = () => {
  return (
    <div className="py-8">
      <div className="container px-4">
        <div className="max-w-4xl mx-auto space-y-12">
          <BoardOfDirectors />
          <AdvisoryBoard />
        </div>
      </div>
    </div>
  );
};
