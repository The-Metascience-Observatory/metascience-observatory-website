/**
 * The replications database is always this file in data/. Its dated version label
 * (replications_database_YYYY_MM_DD_HHMMSS.csv) is the last non-comment line of
 * data/version_history.txt; pages show that label, but nothing opens a file by it.
 */
export const REPLICATIONS_CSV = "replications_database.csv";
