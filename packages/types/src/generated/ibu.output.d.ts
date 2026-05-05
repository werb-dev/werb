/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * Result of an IBU calculation. Aggregate total plus per-addition breakdown.
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
