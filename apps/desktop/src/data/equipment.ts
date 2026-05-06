import type { WerbEquipmentProfile } from "@werb/types";
import type { EquipmentOverrides } from "@werb/adapters";

/**
 * Equipment profile storage layer.
 *
 * One JSON blob in localStorage holds the user's profile list and the
 * active selection. Each profile has a stable ID so screens can reference
 * them. Disk persistence (`<workingDir>/equipment/*.equipment.json`) is a
 * v1.x step — same pattern as recipes.
 */

export interface ProfileWithId extends WerbEquipmentProfile {
  id: string;
}

interface EquipmentStore {
  profiles: ProfileWithId[];
  activeId: string | null;
}

const STORAGE_KEY = "werb.equipment";

const EMPTY_STORE: EquipmentStore = { profiles: [], activeId: null };

export function loadStore(): EquipmentStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<EquipmentStore>;
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
    };
  } catch {
    return EMPTY_STORE;
  }
}

export function saveStore(store: EquipmentStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `eq-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Returns the equipment profile that should drive computations right now,
 * or undefined if the user hasn't picked one (in which case the calcs use
 * their built-in defaults).
 */
export function getActiveProfile(store: EquipmentStore): ProfileWithId | undefined {
  if (!store.activeId) return undefined;
  return store.profiles.find((p) => p.id === store.activeId);
}

/** Map a profile to the override shape consumed by recipeToWaterInput. */
export function profileToWaterOverrides(profile: ProfileWithId | undefined): EquipmentOverrides {
  if (!profile) return {};
  const overrides: EquipmentOverrides = {};
  if (profile.mash_tun?.grain_absorption_l_per_kg !== undefined) {
    overrides.grain_absorption_l_per_kg = profile.mash_tun.grain_absorption_l_per_kg;
  }
  if (profile.mash_tun?.dead_space_l !== undefined) {
    overrides.mash_dead_space_l = profile.mash_tun.dead_space_l;
  }
  if (profile.kettle?.dead_space_l !== undefined) {
    overrides.kettle_dead_space_l = profile.kettle.dead_space_l;
  }
  if (profile.kettle?.evaporation_rate_l_per_hour !== undefined) {
    overrides.evaporation_rate_l_per_hour = profile.kettle.evaporation_rate_l_per_hour;
  }
  if (profile.kettle?.post_boil_shrinkage_pct !== undefined) {
    overrides.post_boil_shrinkage_pct = profile.kettle.post_boil_shrinkage_pct;
  }
  if (profile.transfer_loss_l !== undefined) {
    overrides.kettle_to_fermenter_loss_l = profile.transfer_loss_l;
  }
  return overrides;
}

/**
 * Schema defaults for every numeric field, exposed as a single object so
 * the form can pre-fill empty inputs with reasonable values. Keep these in
 * sync with schemas/werb-equipment.schema.json — when they diverge, the
 * brewer sees stale numbers.
 */
export const DEFAULT_PROFILE_VALUES = {
  batch_size_l: 20,
  efficiency_pct: 75,
  hlt: {
    capacity_l: 50,
    dead_space_l: 0,
  },
  mash_tun: {
    capacity_l: 50,
    dead_space_l: 0,
    grain_absorption_l_per_kg: 0.96,
  },
  kettle: {
    capacity_l: 72,
    dead_space_l: 0,
    evaporation_rate_l_per_hour: 3,
    post_boil_shrinkage_pct: 4,
  },
  fermenter: {
    capacity_l: 25,
    trub_loss_l: 1,
  },
  transfer_loss_l: 0.5,
} as const;
