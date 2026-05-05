/**
 * Living style guide — renders every design token so we can eyeball them
 * in the actual Tauri webview. This is the dev-mode landing page until
 * we have real screens.
 */

const colors = [
  { name: "bg", hex: "#1A0E13", role: "App background", className: "bg-bg" },
  { name: "surface", hex: "#351E28", role: "Cards, panels (Cassis)", className: "bg-surface" },
  { name: "surface-raised", hex: "#4A2C36", role: "Hover, modals", className: "bg-surface-raised" },
  { name: "text", hex: "#F5EFE8", role: "Body copy", className: "bg-text" },
  { name: "text-muted", hex: "#A89B91", role: "Secondary text", className: "bg-text-muted" },
  { name: "accent", hex: "#FF5C34", role: "Primary CTA, live brew (Orange Topaze)", className: "bg-accent" },
  { name: "success", hex: "#AEB8A0", role: "Nominal, target hit (Sage Green)", className: "bg-success" },
  { name: "info", hex: "#D7EFFF", role: "Chilling, neutral emphasis (Cool Blue)", className: "bg-info" },
  { name: "data", hex: "#E9F056", role: "Charts, hop-step highlight (Wasabi)", className: "bg-data" },
  { name: "warning", hex: "#D4A847", role: "True warnings", className: "bg-warning" },
  { name: "danger", hex: "#A4382B", role: "Destructive actions", className: "bg-danger" },
];

const typeRamp = [
  { token: "display", className: "text-display font-semibold" },
  { token: "h1", className: "text-h1 font-semibold" },
  { token: "h2", className: "text-h2 font-semibold" },
  { token: "h3", className: "text-h3 font-semibold" },
  { token: "h4", className: "text-h4 font-medium" },
  { token: "body-lg", className: "text-body-lg" },
  { token: "body", className: "text-body" },
  { token: "body-sm", className: "text-body-sm" },
  { token: "caption", className: "text-caption font-medium" },
];

const spacing = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128];
const radii = [
  { token: "sm", value: 4, className: "rounded-sm" },
  { token: "md", value: 8, className: "rounded-md" },
  { token: "lg", value: 12, className: "rounded-lg" },
  { token: "xl", value: 16, className: "rounded-xl" },
  { token: "2xl", value: 24, className: "rounded-2xl" },
  { token: "pill", value: 9999, className: "rounded-pill" },
];

export function DesignTokensShowcase() {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <div className="mx-auto max-w-5xl px-8 py-16">
        <header className="mb-16">
          <p className="text-caption text-text-muted uppercase tracking-widest">
            Werb · design system v0
          </p>
          <h1 className="text-display font-semibold mt-4">Tokens</h1>
          <p className="text-body-lg text-text-muted mt-4 max-w-2xl">
            Living reference. Edit{" "}
            <code className="font-mono text-mono text-data">apps/desktop/src/styles.css</code> to
            change a token; this page reflects the new value on save.
          </p>
        </header>

        <Section title="Color">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {colors.map((c) => (
              <div
                key={c.name}
                className="rounded-lg border border-border bg-surface overflow-hidden"
              >
                <div className={`${c.className} h-20`} />
                <div className="p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-body font-medium">{c.name}</span>
                    <span className="font-mono text-mono text-text-muted">{c.hex}</span>
                  </div>
                  <p className="text-body-sm text-text-muted mt-1">{c.role}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <div className="space-y-6">
            {typeRamp.map(({ token, className }) => (
              <div key={token} className="flex items-baseline gap-8 border-b border-border pb-6">
                <span className="font-mono text-mono text-text-muted w-24 shrink-0">
                  {token}
                </span>
                <span className={className}>The quick brown fox · 1.054 OG · 38.6 IBU</span>
              </div>
            ))}
            <div className="flex items-baseline gap-8 border-b border-border pb-6">
              <span className="font-mono text-mono text-text-muted w-24 shrink-0">mono</span>
              <span className="font-mono text-mono">{`{ "og": 1.054, "ibu": 38.6 }`}</span>
            </div>
            <div className="flex items-baseline gap-8 border-b border-border pb-6">
              <span className="font-mono text-mono text-text-muted w-24 shrink-0">mono-lg</span>
              <span className="font-mono text-mono-lg text-accent">62:23 · 67.4°C</span>
            </div>
          </div>
        </Section>

        <Section title="Spacing">
          <div className="flex flex-wrap items-end gap-6">
            {spacing.map((px) => (
              <div key={px} className="flex flex-col items-center gap-2">
                <div className="bg-accent" style={{ width: `${px}px`, height: `${px}px` }} />
                <span className="font-mono text-mono text-text-muted">{px}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Radius">
          <div className="flex flex-wrap gap-6">
            {radii.map(({ token, className }) => (
              <div key={token} className="flex flex-col items-center gap-2">
                <div className={`${className} bg-surface-raised border border-border h-24 w-24`} />
                <span className="font-mono text-mono text-text-muted">{token}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Brew-mode preview">
          <div className="rounded-2xl bg-surface border border-border p-8">
            <p className="text-caption text-text-muted uppercase tracking-widest">
              Live · Saison Blanche
            </p>
            <div className="flex items-baseline gap-12 mt-6">
              <Stat label="Mash temp" value="67.4°C" tone="text-accent" />
              <Stat label="Time elapsed" value="32:18" tone="text-text" />
              <Stat label="Target OG" value="1.054" tone="text-success" />
            </div>
          </div>
        </Section>

        <footer className="mt-24 pt-12 border-t border-border">
          <p className="text-body-sm text-text-muted">
            Built with Tauri 2 · React · Vite · Tailwind 4. Tokens live in{" "}
            <code className="font-mono text-mono">styles.css</code>.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <h2 className="text-h2 font-semibold mb-6">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <p className="text-caption text-text-muted uppercase tracking-widest">{label}</p>
      <p className={`font-mono text-display mt-2 ${tone}`}>{value}</p>
    </div>
  );
}
