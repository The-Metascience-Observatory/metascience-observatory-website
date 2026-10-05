/** Side effects plotted in the dose-response section, in panel order.
 *
 *  Matched against the free-text `adverse_events.per_arm[].notable_aes[].event`
 *  strings, first match wins. Headache is deliberately included as a NEGATIVE
 *  CONTROL: lithium and placebo arms report it at the same rate, so any
 *  "dose trend" it shows is between-study artifact, not pharmacology.
 *
 *  Mirrored by EFFECTS in scripts/check_lithium_dose_response.py — keep the
 *  two in step.
 */
export interface EffectDef {
  key: string;
  label: string;
  include: RegExp;
  exclude?: RegExp;
  isControl?: boolean;
}

export const EFFECTS: EffectDef[] = [
  {
    key: "weight_gain",
    label: "Weight gain",
    include: /weight gain|weight increase|increased weight|gained weight|increase in (body )?weight/,
    exclude: /loss/,
  },
  { key: "tremor", label: "Tremor", include: /tremor|shak/ },
  { key: "nausea", label: "Nausea / vomiting", include: /nause|vomit/ },
  { key: "diarrhea", label: "Diarrhea", include: /diarrh|loose stool/ },
  {
    key: "thirst_urination",
    label: "Thirst / frequent urination",
    include: /thirst|polydips|polyur|frequent urination|urinary frequency|increased urination|diuresis/,
  },
  { key: "fatigue", label: "Fatigue / sedation", include: /fatigue|tired|sedat|somnol|drows|letharg|asthen/ },
  { key: "headache", label: "Headache (control)", include: /headache/, isControl: true },
];

export function effectOf(event: string): string | null {
  const s = event.toLowerCase();
  for (const e of EFFECTS) {
    if (e.include.test(s) && !(e.exclude && e.exclude.test(s))) return e.key;
  }
  return null;
}

/** A curve is fitted only with at least this many lithium arms that carry the
 *  x-variable, drawn from at least this many distinct papers. */
export const MIN_ARMS = 5;
export const MIN_PAPERS = 4;
