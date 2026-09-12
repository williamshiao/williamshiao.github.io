import { Section } from "../layout/Section";

// TODO(content): placeholder bio — replace with real copy once drafted.
export function About() {
  return (
    <Section id="about" kicker="Who I am" title="About">
      <div className="grid gap-10 sm:grid-cols-[auto_1fr] sm:items-start">
        <div
          className="h-32 w-32 shrink-0 rounded-2xl border border-line bg-pastel-lilac"
          aria-hidden
        />
        <div className="space-y-4 text-ink-soft">
          <p>
            I'm William, a software engineering graduate currently studying usability and UX
            at Polytechnique Montréal. I like building things that are both technically solid
            and genuinely pleasant to use — this site is itself an attempt at proving both
            sides of that at once.
          </p>
          <p>
            TODO: placeholder paragraph — background, what drew you toward UX, what kind of
            roles/teams you're looking for.
          </p>
          <p>
            TODO: placeholder paragraph — interests outside of work (drawing, games, etc.),
            tying into the Artworks section below.
          </p>
        </div>
      </div>
    </Section>
  );
}
