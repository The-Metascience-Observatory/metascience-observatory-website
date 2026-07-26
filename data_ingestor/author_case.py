"""Author-name case standardization for the replications database.

Fixes ALL-CAPS names ("JAMES R. BEEBE" -> "James R. Beebe", "Eddy NAHMIAS"
-> "Eddy Nahmias") and all-lowercase names ("dean mobbs" -> "Dean Mobbs")
while deliberately leaving alone:

  - organization/consortium entries ("The COVID-19 Host Genetics Initiative",
    "ALSPAC") and "et al." debris,
  - trailing initials blocks in "Surname ABC" style ("Brown GDA", "Vo DTH",
    "ASCH SE" -> "Asch SE"),
  - professional credentials ("PhD", "CCC-SLP"),
  - Roman-numeral suffixes ("III"),

with Mc-prefix ("MCGUIRE" -> "McGuire"), hyphen/apostrophe compound
("AMERINE-DICKENS" -> "Amerine-Dickens", "O'BRIEN" -> "O'Brien") and
diacritic ("SØLVBERG" -> "Sølvberg") handling.

Used by data_ingestor.py so every ingested row gets standardized casing.
The 2026-07-26 one-off cleanup of the existing database used this same
logic (see data_ingestor/author_case_fix_report.txt for what it changed).
"""

from __future__ import annotations

import re
import unicodedata

ROMAN_RE = re.compile(r"^[IVXLCDM]+$")
UNI_HYPHENS = dict.fromkeys(map(ord, "‐‑‒–"), "-")

SKIP_NAMES = {"et al", "et al.", "et. al.", "et.al.", "and colleagues", "and others", "others"}

ORG_KEYWORDS = re.compile(
    r"\b(study|consortium|group|team|project|cohort|bank|databank|biobank|network|"
    r"initiative|collaboration|collaborative|genetics|virology|covid|university|"
    r"hospital|center|centre|institute|laboratory|program|programme|committee|"
    r"consortia|alliance|society|association|accelerator|workgroup|taskforce|"
    r"genomes?|registry|panel|survey)\b",
    re.IGNORECASE,
)

# Professional credentials sometimes glued onto names ("CCC-SLP Steven B.
# Leder PhD") — all-caps tokens matching these are never case-fixed.
CREDENTIAL_TOKENS = {
    "PHD", "MD", "RN", "MPH", "DDS", "JD", "DO", "MBA", "MSC", "BSC", "FRCP",
    "FACP", "CCC-SLP", "SLP", "CCC", "OTR", "PT", "DPT", "PSYD", "EDD",
}

# "Surname ABC" style: a cell where >= 2 names end in a 2-4 letter uppercase
# block is written in Last-Initials format, so those blocks are initials,
# not caps surnames like "Yu KOU".
INITIALS_STYLE_RE = re.compile(r"\s[A-Z]{2,4}$")


def strip_diacritics(s: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFKD", s) if not unicodedata.combining(ch))


def allcaps_words(name: str) -> list[str]:
    """Alphabetic words of >=3 letters that are fully uppercase and not
    Roman numerals — the defect trigger."""
    return [
        w
        for w in re.findall(r"[^\W\d_]{3,}", name, re.UNICODE)
        if w.isupper() and not ROMAN_RE.match(strip_diacritics(w))
    ]


def is_all_lower(name: str) -> bool:
    letters = [c for c in name if c.isalpha()]
    return bool(letters) and all(c.islower() for c in letters)


def is_org_or_skip(name: str) -> bool:
    """Names that must never be case-fixed: 'et al.' debris and
    organization/consortium entries (acronyms like ALSPAC or COVID19 are
    legitimate caps)."""
    if name.casefold().strip() in SKIP_NAMES:
        return True
    if any(ch.isdigit() for ch in name):
        return True
    if any(ch in name for ch in "()/—&"):
        return True
    if len(name.split()) > 6:
        return True
    return bool(ORG_KEYWORDS.search(name))


def trailing_initials_block(name: str, initials_ctx: bool) -> str | None:
    """The final token when it is an uppercase initials block of 2-4 letters,
    e.g. 'Brown GDA', 'Vo DTH', 'ASCH SE' — kept uppercase. A vowel-free
    block (DTH, WJ, SCY) is always initials; a vowel-bearing one (ACE — but
    also caps surnames like KOU) counts as initials only when the containing
    cell is written in 'Surname Initials' style (initials_ctx)."""
    tokens = name.split()
    if len(tokens) < 2:
        return None
    last = tokens[-1]
    if not (2 <= len(last) <= 4 and last.isalpha() and last.isupper()):
        return None
    if ROMAN_RE.match(strip_diacritics(last)):
        return None
    vowel_free = not any(c in "AEIOU" for c in strip_diacritics(last))
    return last if (vowel_free or initials_ctx) else None


def _title_word(word: str) -> str:
    if ROMAN_RE.match(strip_diacritics(word)):
        return word  # II, III, IV ... suffixes stay uppercase
    if len(word) <= 2:
        return word  # initials block ("SE", "ST") stays as written
    def cap_part(p: str) -> str:
        if not p:
            return p
        # McCREA -> McCrea (Mc + consonant); Mac left alone (Macey vs MacLeod
        # is undecidable without a source).
        if len(p) > 3 and p[:2].upper() == "MC":
            return "Mc" + p[2].upper() + p[3:].lower()
        return p[0].upper() + p[1:].lower()
    # capitalize around hyphens and apostrophes: AMERINE-DICKENS, O'BRIEN
    word = "-".join(cap_part(p) for p in word.split("-"))
    for apo in ("'", "’"):
        if apo in word:
            word = apo.join(p[0].upper() + p[1:] if p else p for p in word.split(apo))
    return word


def smart_title_case(name: str, initials_ctx: bool = False) -> str:
    """Title-case only the all-caps words (>=3 letters), leaving words that
    already carry lowercase letters untouched ('Eddy NAHMIAS' -> 'Eddy
    Nahmias'; 'ASCH SE' -> 'Asch SE'), preserving trailing initials blocks
    ('Brown GDA', 'Vo DTH') and credential tokens (PhD, CCC-SLP)."""
    bad = set(allcaps_words(name))
    if not bad:
        return name
    keep = trailing_initials_block(name, initials_ctx)
    def fix(m: re.Match) -> str:
        w = m.group(0)
        if keep and w == keep and m.end() == len(name.rstrip()):
            return w
        if w.upper() in CREDENTIAL_TOKENS:
            return w
        # hyphen/apostrophe compounds ('AMERINE-DICKENS') match as one word;
        # fix them when any component is an offending all-caps word
        parts = re.split(r"['’-]", w)
        if all(p.upper() in CREDENTIAL_TOKENS for p in parts if p):
            return w
        return _title_word(w) if any(p in bad for p in parts) else w
    return re.sub(r"[^\W\d_]+(?:['’-][^\W\d_]+)*", fix, name, flags=re.UNICODE)


def standardize_author_name(name: str, initials_ctx: bool = False) -> str:
    """Proper-case one author name; org names, 'et al.' and already-proper
    names come back unchanged."""
    if not isinstance(name, str) or not name.strip():
        return name
    name = name.strip()
    if is_org_or_skip(name):
        return name
    if is_all_lower(name):
        return " ".join(_title_word(w) if len(w) >= 3 else w for w in name.split(" "))
    return smart_title_case(name, initials_ctx)


def standardize_authors_cell(authors_str):
    """Standardize a semicolon-separated authors cell. Non-strings and
    empty/whitespace values pass through unchanged (safe on NaN)."""
    if not isinstance(authors_str, str) or not authors_str.strip():
        return authors_str
    names = [n.strip() for n in authors_str.split(";") if n.strip()]
    initials_ctx = sum(1 for n in names if INITIALS_STYLE_RE.search(n)) >= 2
    return "; ".join(standardize_author_name(n, initials_ctx) for n in names)
