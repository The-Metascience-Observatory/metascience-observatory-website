import path from 'node:path';
/** Operator-only override for validating a staged bundle before installing it. */
export function longCovidDataPath(name=''):string {
 return path.join(process.env.LONG_COVID_DATA_DIR || path.join(process.cwd(),'data/birds_eye_reviews/long_covid'),name);
}
