/* eslint-disable */
/**
 * Auto-generated from schemas/tools/ibu.output.schema.json.
 * DO NOT EDIT — run `pnpm gen:types` to regenerate.
 */

export interface IbuOutput {
  method: "Tinseth" | "Rager" | "Garetz" | "Other";
  /**
   * Total estimated bitterness in IBU (mg/L of iso-alpha-acids).
   */
  total_ibu: number;
  additions: IbuAdditionResult[];
}

export interface IbuAdditionResult {
  name?: string;
  /**
   * IBU contribution of this single addition.
   */
  ibu: number;
  /**
   * Utilization fraction applied (0-1).
   */
  utilization: number;
}
