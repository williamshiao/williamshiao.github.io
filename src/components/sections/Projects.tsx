import { useLanguage } from "../../context/LanguageContext";
import { projects, type Project, type ProjectGroup } from "../../data/projects";
import type { StringKey } from "../../i18n/strings";

const GROUPS: { id: ProjectGroup; headingKey: StringKey }[] = [
  { id: "engineering", headingKey: "projectsEngineeringHeading" },
  { id: "games", headingKey: "projectsGamesHeading" },
];

const LINK_LABEL_KEY: Record<NonNullable<Project["link"]>["kind"], StringKey> = {
  video: "projectsLinkVideo",
  play: "projectsLinkPlay",
  page: "projectsLinkPage",
};

function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

// Two groups (what was built for coursework/engineering vs. the games) on
// the same card grid — each card links straight out to its demo when there
// is one (see ../../data/projects for where those links come from).
export function Projects() {
  const { lang, t } = useLanguage();
  return (
    <div className="space-y-10">
      <p className="text-ink-soft">{t("projectsIntro")}</p>
      {GROUPS.map((group) => (
        <section key={group.id} className="space-y-4">
          <h3 className="font-pixel text-[0.65rem] uppercase tracking-widest text-ditto">{t(group.headingKey)}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {projects
              .filter((p) => p.group === group.id)
              .map((project) => (
                <article
                  key={project.id}
                  className="flex flex-col rounded-2xl border border-line bg-canvas px-5 py-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 data-blob-target="text" className="font-display text-base font-semibold text-ink">
                      {project.title[lang]}
                    </h4>
                    <span className="shrink-0 text-xs text-ink-soft/80">{project.period[lang]}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">{project.summary[lang]}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <span
                        key={`${project.id}-${tag}`}
                        className="rounded-full bg-pastel-blue px-2.5 py-0.5 text-xs font-medium text-ink-soft"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {/* mt-auto pins the link row to the card's bottom, so links line
                      up across a row of cards with different amounts of text. */}
                  {project.link && (
                    <div className="mt-auto pt-4">
                      <a
                        href={project.link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink underline decoration-line decoration-2 underline-offset-4 transition-colors hover:decoration-ditto"
                      >
                        {t(LINK_LABEL_KEY[project.link.kind])}
                        <ExternalIcon />
                      </a>
                    </div>
                  )}
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
