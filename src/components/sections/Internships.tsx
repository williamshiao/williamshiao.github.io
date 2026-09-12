import { internships } from "../../data/internships";

export function Internships() {
  return (
    <div className="space-y-10">
      {internships.map((job) => (
        <article key={job.id} className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div>
            <h3
              data-blob-target="text"
              className="inline-block font-display text-lg font-semibold text-ink"
            >
              {job.company}
            </h3>
            <p className="text-sm text-ink-soft">{job.role}</p>
            <p className="mt-1 text-xs text-ink-soft/80">
              {job.period} · {job.location}
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-ink-soft">{job.summary}</p>
            <ul className="space-y-1.5">
              {job.highlights.map((point, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink-soft">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ditto" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              {job.stack.map((tech, i) => (
                <span
                  key={`${job.id}-stack-${i}`}
                  className="rounded-full bg-pastel-blue px-3 py-1 text-xs font-medium text-ink-soft"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
