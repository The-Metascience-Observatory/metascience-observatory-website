declare module "jstat" {
  interface Distribution {
    cdf(x: number, ...params: number[]): number;
    pdf(x: number, ...params: number[]): number;
    inv(p: number, ...params: number[]): number;
  }

  export const jStat: {
    studentt: Distribution;
    normal: Distribution;
    beta: Distribution;
    ibeta(x: number, a: number, b: number): number;
  };
}
