import { useState } from "react";
import { useT } from "../../data/preferences.tsx";
import { translateError } from "../../data/errors.ts";
import { isTauri } from "../../data/runtime.ts";
import {
  fetchCommuneAnalyses,
  isValidInsee,
  type CommuneAnalyses,
  type WaterAnalysis,
} from "../../data/moneaudebrassage.ts";
import { analysisToIons, MAB_CACHE_KEY, type IonProfile } from "../../data/home-water.ts";
import { usePersistedJson } from "../../storage/index.ts";

/**
 * Fill the ions from the moneaudebrassage.fr public analysis for a French
 * commune. Desktop only: the API is cross-origin and Origin-gated, which a
 * browser fetch can't satisfy. The last pull is cached for offline use.
 */
export function MabLoader({ onLoad }: { onLoad: (ions: IonProfile) => void }) {
  const t = useT();
  const desktop = isTauri();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = usePersistedJson<CommuneAnalyses | null>(MAB_CACHE_KEY, null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchCommuneAnalyses(code);
      setCache(res);
      // One network → apply straight away; several → let the brewer
      // pick from the list the panel renders below.
      const only = res.networks[0];
      if (res.networks.length === 1 && only) onLoad(analysisToIons(only));
    } catch (err) {
      setError(translateError(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-caption font-medium text-accent hover:opacity-80 transition-opacity"
        >
          {t("recipe.water.from_mab")}
        </button>
      </div>

      {open && (
        <div
          data-testid="water-mab-panel"
          className="rounded-lg bg-surface-raised border border-border p-3"
        >
          {desktop ? (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="block text-caption uppercase tracking-widest text-text-muted mb-1">
                    {t("recipe.water.mab_insee")}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={code}
                    placeholder="73008"
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isValidInsee(code) && !loading) submit();
                    }}
                    className="w-28 bg-bg border border-border rounded-lg px-2 py-1.5 text-body-sm font-mono tabular-nums text-text focus:outline-none focus:border-accent"
                  />
                </label>
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading || !isValidInsee(code)}
                  className="rounded-lg bg-accent text-bg px-3 py-1.5 text-body-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-default transition-opacity"
                >
                  {loading ? t("recipe.water.mab_loading") : t("recipe.water.mab_load")}
                </button>
              </div>
              {error && <p className="mt-2 text-caption text-warning">{error}</p>}
              {cache && cache.networks.length > 0 && (
                <MabNetworkList
                  commune={cache}
                  onPick={(a) => onLoad(analysisToIons(a))}
                />
              )}
            </>
          ) : (
            <p className="text-caption text-text-muted">{t("recipe.water.mab_desktop_only")}</p>
          )}
          <p className="mt-3 text-caption text-text-muted opacity-70">
            {t("recipe.water.mab_attribution")}
          </p>
        </div>
      )}
    </div>
  );
}

/** Per-network rows from a moneaudebrassage pull; click one to apply. */
function MabNetworkList({
  commune,
  onPick,
}: {
  commune: CommuneAnalyses;
  onPick: (a: WaterAnalysis) => void;
}) {
  const t = useT();
  return (
    <div className="mt-3">
      <p className="text-caption uppercase tracking-widest text-text-muted mb-2">
        {t("recipe.water.mab_networks", { insee: commune.insee })}
      </p>
      <div className="flex flex-col gap-1">
        {commune.networks.map((a, i) => (
          <button
            key={`${a.network}-${i}`}
            type="button"
            onClick={() => onPick(a)}
            className="text-left rounded-lg border border-border px-3 py-2 hover:border-accent transition-colors"
          >
            <span className="block text-body-sm text-text">
              {a.network}
              {a.date ? <span className="text-text-muted"> · {a.date}</span> : null}
            </span>
            <span className="block text-caption font-mono text-text-muted mt-0.5">
              Ca {a.ca_ppm.toFixed(0)} · Mg {a.mg_ppm.toFixed(0)} · Na {a.na_ppm.toFixed(0)} · Cl{" "}
              {a.cl_ppm.toFixed(0)} · SO₄ {a.so4_ppm.toFixed(0)} · HCO₃ {a.hco3_ppm.toFixed(0)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
