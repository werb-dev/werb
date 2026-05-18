import type { ReactNode } from "react";

/** Brew-screen section header. Simpler than the Recipe one — no subtitle slot. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8 sm:mb-10">
      <h2 className="text-h3 font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}
