import { usePersistedJson } from "../storage/index.ts";
import type { WaterAnalysis } from "./moneaudebrassage.ts";

/**
 * The brewer's own water ("My water"), set in Settings. New recipes start
 * from it and every recipe's water chemistry offers it next to the city
 * profiles. Local preference: not synced with recipes.
 */

export interface IonProfile {
  ca_ppm: number;
  mg_ppm: number;
  na_ppm: number;
  cl_ppm: number;
  so4_ppm: number;
  hco3_ppm: number;
}

export const ZERO_IONS: IonProfile = {
  ca_ppm: 0, mg_ppm: 0, na_ppm: 0, cl_ppm: 0, so4_ppm: 0, hco3_ppm: 0,
};

export const HOME_WATER_KEY = "local.prefs.water";

/** Last moneaudebrassage.fr pull, kept so the home commune works offline. */
export const MAB_CACHE_KEY = "local.prefs.water.mab";

export function useHomeWater() {
  return usePersistedJson<IonProfile>(HOME_WATER_KEY, ZERO_IONS);
}

export function ionsEqual(a: IonProfile, b: IonProfile): boolean {
  return (
    a.ca_ppm === b.ca_ppm &&
    a.mg_ppm === b.mg_ppm &&
    a.na_ppm === b.na_ppm &&
    a.cl_ppm === b.cl_ppm &&
    a.so4_ppm === b.so4_ppm &&
    a.hco3_ppm === b.hco3_ppm
  );
}

/** All six ions at zero: the brewer hasn't set their water. */
export function isUnsetWater(ions: IonProfile): boolean {
  return ionsEqual(ions, ZERO_IONS);
}

export function analysisToIons(a: WaterAnalysis): IonProfile {
  return {
    ca_ppm: a.ca_ppm,
    mg_ppm: a.mg_ppm,
    na_ppm: a.na_ppm,
    cl_ppm: a.cl_ppm,
    so4_ppm: a.so4_ppm,
    hco3_ppm: a.hco3_ppm,
  };
}
