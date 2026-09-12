export interface Artwork {
  id: string;
  title: string;
  medium: string;
  year: string;
  // TODO(content): swap for real image paths once artwork scans/photos are ready.
  placeholderColor: string;
}

// TODO(content): placeholder set — replace with real drawings.
export const artworks: Artwork[] = [
  { id: "artwork-1", title: "Untitled I", medium: "Ink on paper", year: "2024", placeholderColor: "var(--color-pastel-pink)" },
  { id: "artwork-2", title: "Untitled II", medium: "Digital", year: "2024", placeholderColor: "var(--color-pastel-lilac)" },
  { id: "artwork-3", title: "Untitled III", medium: "Graphite", year: "2023", placeholderColor: "var(--color-pastel-blue)" },
  { id: "artwork-4", title: "Untitled IV", medium: "Watercolor", year: "2023", placeholderColor: "var(--color-pastel-mint)" },
  { id: "artwork-5", title: "Untitled V", medium: "Digital", year: "2023", placeholderColor: "var(--color-pastel-sand)" },
  { id: "artwork-6", title: "Untitled VI", medium: "Ink on paper", year: "2022", placeholderColor: "var(--color-pastel-pink)" },
];
