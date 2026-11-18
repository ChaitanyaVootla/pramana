// Minimal typings for edtf.js (https://github.com/inukshuk/edtf.js), which ships none.
declare module "edtf" {
  interface EdtfValue {
    type: string;
    min: number;
    max: number;
    edtf: string;
    lower?: EdtfValue;
    upper?: EdtfValue;
    approximate?: unknown;
    uncertain?: unknown;
  }
  function edtf(input: string | { type: string }, options?: Record<string, unknown>): EdtfValue;
  /** The grammar's parse result; `type` is the grammar's name ("Date", "Interval"…), stable under minification. */
  export function parse(input: string, constraints?: Record<string, unknown>): { type: string };
  export default edtf;
}
