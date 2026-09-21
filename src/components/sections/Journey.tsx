import { useLanguage } from "../../context/LanguageContext";
import { journey } from "../../data/journey";

// One vertical timeline for both work and study, newest first — a filled
// dot marks a job, a hollow one a school, so the two read as parts of the
// same path without needing separate Experience/Education headings.
export function Journey() {
  const { lang, t } = useLanguage();
  return (
    <div className="space-y-8">
      <p className="text-ink-soft">{t("journeyIntro")}</p>
      <ol className="relative space-y-9 border-l border-line pl-7">
        {journey.map((entry) => (
          <li key={entry.id} className="relative">
            <span
              aria-hidden
              className={`absolute -left-[2.15rem] top-1.5 h-3 w-3 rounded-full border-2 border-ditto ${
                entry.kind === "work" ? "bg-ditto" : "bg-surface"
              }`}
            />
            <p className="font-pixel text-[0.6rem] uppercase tracking-widest text-ink-soft/80">
              {entry.period[lang]}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 data-blob-target="text" className="font-display text-lg font-semibold text-ink">
                {entry.title[lang]}
              </h3>
              {entry.note && (
                <span className="rounded-full bg-pastel-lilac px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                  {entry.note[lang]}
                </span>
              )}
            </div>
            <p className="text-sm text-ink-soft">
              {entry.location ? `${entry.org} · ${entry.location}` : entry.org}
            </p>
            {entry.highlights && (
              <ul className="mt-3 space-y-1.5">
                {entry.highlights.map((point, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-soft">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ditto" aria-hidden />
                    {point[lang]}
                  </li>
                ))}
              </ul>
            )}
            {entry.tags && (
              <div className="mt-3 flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <span
                    key={`${entry.id}-${tag}`}
                    className="rounded-full bg-pastel-blue px-3 py-1 text-xs font-medium text-ink-soft"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
