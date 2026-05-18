import type { ReactNode } from "react";

/**
 * Recipe-screen section heading + body wrapper. Optional subtitle
 * sits under the h2 and disappears cleanly when absent.
 *
 * Note: the Brew, Equipment, and Settings screens have their own
 * Section components with slightly different shells. They're
 * deliberately left separate — each screen has its own visual
 * rhythm — but kept in sync structurally.
 */
export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section className="mb-8 sm:mb-10 lg:mb-12">
      <h2 className="text-h3 font-semibold mb-1">{title}</h2>
      {subtitle && <p className="text-body-sm text-text-muted mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}
