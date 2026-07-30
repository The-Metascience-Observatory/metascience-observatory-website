import Link from "next/link";
import { SUCCESS_RATE_DEFINITION, type SuccessDef } from "@/lib/replicationOutcome";

/**
 * The one-line disclosure that must accompany every replication rate shown on
 * the site.
 *
 * Every page reads the same `result` column but used to apply a slightly
 * different rule to it — whether a reversal counted as a failure or was dropped,
 * whether inconclusive sat in the denominator, whether the unit was an effect or
 * a paper — so the same column produced a range of different headline numbers
 * with nothing on the page to reconcile them. The rule is now frozen in
 * lib/replicationOutcome; this component makes it visible so a reader comparing
 * two pages can tell at a glance whether they are comparing like with like.
 */

type Unit = "effect" | "paper";

const DEF_LABELS: Record<SuccessDef, string> = {
  reported: "the outcome recorded in the database",
  significance: "a statistically significant effect in the same direction",
  orig_in_rep_ci: "the original effect size falling inside the replication's 95% CI",
  rep_in_orig_ci: "the replication effect size falling inside the original's 95% CI",
};

export function SuccessRateNote({
  def = "reported",
  unit = "effect",
  n,
  threshold,
  filter,
  className = "",
}: {
  /** Which definition of "success" the displayed rate uses. */
  def?: SuccessDef;
  /** Whether the denominator counts replication effects or original papers. */
  unit?: Unit;
  /** The denominator actually used for the displayed rate. */
  n?: number | null;
  /** Paper-level only: the share of an original's effects that must succeed. */
  threshold?: number;
  /**
   * Any row filter narrowing the denominator below the full database — e.g.
   * "restricted to originals matched in the h-index dataset". Stating this is
   * what reconciles a page's number with the site-wide one.
   */
  filter?: string;
  className?: string;
}) {
  const unitLabel = unit === "paper" ? "original paper" : "replication effect";
  const nLabel = n != null ? ` (n = ${n.toLocaleString()}${filter ? ` — ${filter}` : ""})` : "";

  return (
    <p className={`text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 ${className}`}>
      Rate = {SUCCESS_RATE_DEFINITION}, where success means {DEF_LABELS[def]}. Unit:{" "}
      {unitLabel}
      {nLabel}.
      {unit === "paper" && threshold != null && (
        <>
          {" "}
          A paper counts as replicated when at least {Math.round(threshold * 100)}% of its
          determinate effects succeeded.
        </>
      )}{" "}
      <Link
        href="/docs/replication-outcome-classification"
        className="underline hover:text-gray-700 dark:hover:text-gray-200"
      >
        How this is defined
      </Link>
      .
    </p>
  );
}
