import type { WerbEquipmentProfile } from "@werb/types";
import type { EquipmentOverrides } from "@werb/adapters";
import type { StorageBackend } from "../storage/index.ts";

/**
 * Equipment profile storage layer.
 *
 * One JSON blob holds the user's profile list and the active selection.
 * Each profile has a stable ID so screens can reference them. The
 * persistence target is abstracted behind StorageBackend so we can swap
 * localStorage for Drive / GitHub / OPFS without touching this module.
 */

export interface ProfileWithId extends WerbEquipmentProfile {
  id: string;
}

interface EquipmentStore {
  profiles: ProfileWithId[];
  activeId: string | null;
}

export const EQUIPMENT_STORAGE_KEY = "werb.equipment";

const EMPTY_STORE: EquipmentStore = { profiles: [], activeId: null };

function parseStore(raw: string | null): EquipmentStore {
  if (!raw) return EMPTY_STORE;
  try {
    const parsed = JSON.parse(raw) as Partial<EquipmentStore>;
    const profiles = (Array.isArray(parsed.profiles) ? parsed.profiles : []).map(
      migrateProfile,
    );
    return {
      profiles,
      activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
    };
  } catch {
    return EMPTY_STORE;
  }
}

/** Sync hydration for hooks; empty when the backend has no readSync. */
export function loadStoreSync(backend: StorageBackend): EquipmentStore {
  if (!backend.readSync) return EMPTY_STORE;
  return parseStore(backend.readSync(EQUIPMENT_STORAGE_KEY));
}

export async function loadStore(backend: StorageBackend): Promise<EquipmentStore> {
  return parseStore(await backend.read(EQUIPMENT_STORAGE_KEY));
}

/**
 * Backfill optional sections that older saved profiles may not have. The
 * editor displays defaults for missing sections but only writes on change,
 * so a profile created before a section existed (e.g. `hlt` was added in
 * a later version) silently lacks that section. Downstream consumers like
 * the brew-screen HLT-fit warning rely on the section being present, so
 * normalize on load.
 */
function migrateProfile(p: ProfileWithId): ProfileWithId {
  return {
    ...p,
    hlt: p.hlt ?? { ...DEFAULT_PROFILE_VALUES.hlt },
  };
}

export async function saveStore(
  backend: StorageBackend,
  store: EquipmentStore,
): Promise<void> {
  await backend.write(EQUIPMENT_STORAGE_KEY, JSON.stringify(store));
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
  if (profile.mash_tun?.mash_thickness_l_per_kg !== undefined) {
    overrides.mash_thickness_l_per_kg = profile.mash_tun.mash_thickness_l_per_kg;
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
  if (profile.mash_mode === "biab") {
    overrides.biab = true;
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
    mash_thickness_l_per_kg: 3,
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
