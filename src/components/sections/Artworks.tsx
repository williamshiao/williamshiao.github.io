import { useLanguage } from "../../context/LanguageContext";
import { ARTSTATION_URL, artworks } from "../../data/artworks";

function ArtstationMarkIcon() {
  // ArtStation's own mark (the stylized "A" arrow) — simplified to a single
  // path so it inherits currentColor like the Contact panel's icons do,
  // rather than shipping their multi-tone brand SVG wholesale.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M13.98 3H8.71l8.53 14.77 2.63-4.55L13.98 3ZM4.29 16.23 1.66 20.8H21v-1.6H5.51l-1.22-2.97ZM10.02 8.36 4.03 18.7h5.34l6-10.35-5.35-.01Z" />
    </svg>
  );
}

// A small art showcase — a handful of personal drawings plus a prominent
// link out to the full ArtStation portfolio (see ../../data/artworks). Same
// click-to-expand panel treatment as Journey/Contact (see
// ../physics/FloatingShapes' "artworks" pageId).
export function Artworks() {
  const { t } = useLanguage();
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-ink-soft">{t("artworksIntro")}</p>
        <a
          href={ARTSTATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex shrink-0 items-center gap-3 rounded-2xl border border-line bg-canvas px-5 py-3 transition-colors hover:border-ditto"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pastel-mint/60 text-ink">
            <ArtstationMarkIcon />
          </span>
          <span className="text-sm font-medium text-ink">{t("artworksArtstationLabel")}</span>
        </a>
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
        {artworks.map((artwork) => (
          <a
            key={artwork.id}
            href={artwork.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group"
            data-blob-target
          >
            <div className="aspect-square overflow-hidden rounded-lg outline outline-2 outline-offset-2 outline-line transition-transform group-hover:-translate-y-1">
              <img
                src={artwork.image}
                alt={artwork.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <figcaption className="mt-2 text-sm">
              <span className="block truncate font-medium text-ink">{artwork.title}</span>
              <span className="text-ink-soft">{artwork.year}</span>
            </figcaption>
          </a>
        ))}
      </div>
    </div>
  );
}
