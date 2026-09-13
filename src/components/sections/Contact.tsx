import { useLanguage } from "../../context/LanguageContext";
import { CONTACT_EMAIL, GITHUB_URL } from "../../data/contact";

// Two link cards, not the shape-icon treatment the old envelope/code-badge
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

export function Contact() {
  const { t } = useLanguage();
  return (
    <div className="space-y-8">
      <p className="text-ink-soft">{t("contactIntro")}</p>
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* A plain mailto: link — opens the visitor's own mail client with
            the address pre-filled; nothing is sent automatically. */}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="group flex flex-1 items-center gap-4 rounded-2xl border border-line bg-canvas px-5 py-4 transition-colors hover:border-ditto"
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
          className="group flex flex-1 items-center gap-4 rounded-2xl border border-line bg-canvas px-5 py-4 transition-colors hover:border-ditto"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pastel-blue/60 text-ink">
            <CodeIcon />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold text-ink">{t("contactGithubLabel")}</span>
            <span className="block truncate text-sm text-ink-soft">{GITHUB_URL.replace(/^https?:\/\//, "")}</span>
          </span>
        </a>
      </div>
    </div>
  );
}
