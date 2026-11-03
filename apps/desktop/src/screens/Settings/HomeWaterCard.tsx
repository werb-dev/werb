import { useT } from "../../data/preferences.tsx";
import { useHomeWater } from "../../data/home-water.ts";
import { IonFields } from "../../components/water/IonFields.tsx";
import { MabLoader } from "../../components/water/MabLoader.tsx";

/** Settings card for "My water", the brewer's own source water. */
export function HomeWaterCard() {
  const t = useT();
  const [water, setWater] = useHomeWater();
  return (
    <div
      data-testid="home-water"
      className="rounded-xl bg-surface border border-border p-4 sm:p-6"
    >
      <p className="text-body-sm text-text-muted mb-5 max-w-prose">
        {t("settings.water.intro")}
      </p>
      <p className="text-caption uppercase tracking-widest text-text-muted mb-3">
        {t("recipe.water.source_ppm")}
      </p>
      <IonFields ions={water} onChange={setWater} testIdPrefix="home-water" />
      <MabLoader onLoad={setWater} />
    </div>
  );
}
