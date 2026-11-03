import type { IonProfile } from "../../data/home-water.ts";
import { useNumericText } from "../editor/Fields.tsx";

/** The six brewing ions as editable ppm fields. */
export function IonFields({
  ions,
  onChange,
  testIdPrefix,
}: {
  ions: IonProfile;
  onChange: (next: IonProfile) => void;
  /** Gives each input `data-testid="<prefix>-<ion key>"`. */
  testIdPrefix?: string;
}) {
  const field = (label: string, key: keyof IonProfile) => (
    <IonField
      label={label}
      value={ions[key]}
      onChange={(v) => onChange({ ...ions, [key]: v })}
      {...(testIdPrefix && { testId: `${testIdPrefix}-${key}` })}
    />
  );
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
      {field("Ca²⁺", "ca_ppm")}
      {field("Mg²⁺", "mg_ppm")}
      {field("Na⁺", "na_ppm")}
      {field("Cl⁻", "cl_ppm")}
      {field("SO₄²⁻", "so4_ppm")}
      {field("HCO₃⁻", "hco3_ppm")}
    </div>
  );
}

function IonField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  testId?: string;
}) {
  return (
    <label className="block">
      <span className="block text-caption font-mono text-text-muted mb-1">{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        data-testid={testId}
        {...useNumericText(value, (n) => onChange(Math.max(0, n)))}
        className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-body-sm font-mono tabular-nums text-text focus:outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
    </label>
  );
}
