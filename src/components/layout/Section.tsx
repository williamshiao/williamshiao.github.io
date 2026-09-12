import type { PropsWithChildren } from "react";

interface SectionProps {
  id: string;
  kicker: string;
  title: string;
}

/** Shared section shell: consistent width, spacing, and heading treatment. */
export function Section({ id, kicker, title, children }: PropsWithChildren<SectionProps>) {
  return (
    <section id={id} className="mx-auto max-w-5xl scroll-mt-20 px-6 py-20 sm:py-28">
      <p className="font-pixel text-[10px] uppercase tracking-widest text-ditto">{kicker}</p>
      <h2 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">{title}</h2>
      <div className="mt-10">{children}</div>
    </section>
  );
}
