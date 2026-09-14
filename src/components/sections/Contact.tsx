import { useLanguage } from "../../context/LanguageContext";
import { CONTACT_EMAIL, GITHUB_URL, LINKEDIN_URL } from "../../data/contact";

// Link cards, not the shape-icon treatment the old envelope/code-badge
// shapes had — this panel *is* their consolidated destination now (see
// FloatingShapes' intro comment and ./shapes' single "contact" pageId
// shape), so the icons just need to read clearly at UI scale, not carry a
// whole stencil-icon personality of their own.
function EnvelopeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M9 6l-5 6 5 6" />
      <path d="M15 6l5 6-5 6" />
    </svg>
  );
}

// A simplified, single-color take on the LinkedIn glyph (a badge with an
// "i" and an "n") drawn as plain strokes so it sits at the same visual
// weight as the envelope/code icons above, rather than dropping in the
// full two-tone brand mark.
function LinkedInIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <line x1="7.5" y1="10" x2="7.5" y2="16.5" />
      <circle cx="7.5" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
      <path d="M11.5 16.5v-4a2.3 2.3 0 0 1 4.6 0v4" />
    </svg>
  );
}

export function Contact() {
  const { t } = useLanguage();
  return (
    <div className="space-y-8">
      <p className="text-ink-soft">{t("contactIntro")}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {/* A plain mailto: link — opens the visitor's own mail client with
            the address pre-filled; nothing is sent automatically. */}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="group flex items-center gap-4 rounded-2xl border border-line bg-canvas px-5 py-4 transition-colors hover:border-ditto"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pastel-pink/60 text-ink">
            <EnvelopeIcon />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold text-ink">{t("contactEmailLabel")}</span>
            <span className="block truncate text-sm text-ink-soft">{CONTACT_EMAIL}</span>
          </span>
        </a>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-2xl border border-line bg-canvas px-5 py-4 transition-colors hover:border-ditto"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pastel-blue/60 text-ink">
            <CodeIcon />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold text-ink">{t("contactGithubLabel")}</span>
            <span className="block truncate text-sm text-ink-soft">{GITHUB_URL.replace(/^https?:\/\//, "")}</span>
          </span>
        </a>
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-2xl border border-line bg-canvas px-5 py-4 transition-colors hover:border-ditto"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pastel-mint/60 text-ink">
            <LinkedInIcon />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold text-ink">{t("contactLinkedinLabel")}</span>
            <span className="block truncate text-sm text-ink-soft">
              {LINKEDIN_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </span>
          </span>
        </a>
      </div>
    </div>
  );
}
