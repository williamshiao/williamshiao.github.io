import { Section } from "../layout/Section";
import { artworks } from "../../data/artworks";

// TODO(content): placeholder tiles — replace placeholderColor blocks with real images.
export function Artworks() {
  return (
    <Section id="artworks" kicker="Personal drawings" title="Artworks">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        {artworks.map((artwork) => (
          <figure key={artwork.id} className="group" data-blob-target>
            {/* Pixel-art-inspired frame: a stepped double border as a small retro accent
                around otherwise clean, modern thumbnails. */}
            <div
              className="aspect-square rounded-lg p-1.5 outline outline-2 outline-offset-2 outline-line transition-transform group-hover:-translate-y-1"
              style={{ backgroundColor: artwork.placeholderColor }}
            >
              <div className="h-full w-full rounded-md border-2 border-white/60" />
            </div>
            <figcaption className="mt-3 text-sm">
              <span className="block font-medium text-ink">{artwork.title}</span>
              <span className="text-ink-soft">
                {artwork.medium} · {artwork.year}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
