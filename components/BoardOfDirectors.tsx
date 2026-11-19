import { Card } from "@/components/ui/card";

const DIRECTORS = [
  "Dan Elton",
  "Greg Fitzgerald",
  "Remy Dygert",
  "Preston Estep III",
  "Derik Kauffman",
];

export const BoardOfDirectors = () => {
  return (
    <section id="board-of-directors" className="scroll-mt-24 space-y-6">
          <div className="text-center space-y-4">
            <h2 className="font-clarendon text-2xl md:text-3xl font-bold">
              Board of Directors
            </h2>
          </div>

          <Card className="p-8 md:p-10 shadow-lg">
            <div className="space-y-4">
              {DIRECTORS.map((name) => (
                <h3 key={name} className="text-lg font-semibold">
                  {name}
                </h3>
              ))}
            </div>
          </Card>
    </section>
  );
};
