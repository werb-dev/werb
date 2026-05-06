/* eslint-disable */
/**
 * Auto-generated. DO NOT EDIT.
 * Run `pnpm gen:types` to regenerate.
 */

/**
 * A live record of a brew day. References a source recipe by ID and freezes a snapshot of it at session start so later edits to the recipe don't mutate the brew log.
 */
export interface WerbSession {
  /**
   * Unique session ID (typically a UUID or ISO timestamp).
   */
  id: string;
  /**
   * Pointer to the source recipe (the LoadedRecipe.id, which is a file basename in v0).
   */
  recipe_id: string;
  /**
   * Human-readable recipe name, copied for offline display when the recipe file is unavailable.
   */
  recipe_name?: string;
  status: "draft" | "in_progress" | "completed" | "abandoned";
  started_at: string;
  completed_at?: string;
  steps: SessionStep[];
  /**
   * Point-in-time readings logged during the brew. Optional in v0 (no UI yet).
   */
  measurements?: Measurement[];
  notes?: string;
}
export interface SessionStep {
  id: string;
  kind:
    | "prepare_water"
    | "mash_in"
    | "mash"
    | "sparge"
    | "boil"
    | "hop_addition"
    | "whirlpool"
    | "chill"
    | "transfer"
    | "ferment_pitch"
    | "custom";
  /**
   * Short human-readable label (e.g. 'Saccharification', 'Mosaic 30g flameout').
   */
  label: string;
  status: "pending" | "active" | "done" | "skipped";
  started_at?: string;
  completed_at?: string;
  /**
   * Planned duration. The Brew screen shows it as a countdown when the step is active.
   */
  target_duration_min?: number;
  target_temperature_c?: number;
  notes?: string;
}
export interface Measurement {
  at: string;
  kind: "temperature_c" | "gravity_sg" | "ph" | "volume_l" | "abv_pct";
  value: number;
  step_id?: string;
  notes?: string;
}
