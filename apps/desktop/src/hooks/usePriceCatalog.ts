import { useCallback } from "react";
import { usePersistedJson } from "../storage/index.ts";
import {
  EMPTY_CATALOG,
  PRICES_STORAGE_KEY,
  upsertPrice,
  removePrice,
  type PriceCatalog,
  type PriceUnit,
} from "../data/prices.ts";

/**
 * Reactive handle to the global price catalog. Reads from
 * `werb.prices` via the active StorageBackend so it syncs the same way
 * recipes do (OPFS / GitHub backup / local fallback).
 */
export function usePriceCatalog(): {
  catalog: PriceCatalog;
  setPrice: (name: string, unit_price: number, natural_unit: PriceUnit) => void;
  unsetPrice: (name: string) => void;
} {
  const [catalog, setCatalog] = usePersistedJson<PriceCatalog>(
    PRICES_STORAGE_KEY,
    EMPTY_CATALOG,
  );

  const setPrice = useCallback(
    (name: string, unit_price: number, natural_unit: PriceUnit) => {
      setCatalog((prev) => upsertPrice(prev, name, unit_price, natural_unit));
    },
    [setCatalog],
  );

  const unsetPrice = useCallback(
    (name: string) => {
      setCatalog((prev) => removePrice(prev, name));
    },
    [setCatalog],
  );

  return { catalog, setPrice, unsetPrice };
}
