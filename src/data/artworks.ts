// Real pieces pulled from the ArtStation portfolio (see ARTSTATION_URL) —
// same order ArtStation itself lists them in (newest first). Images live in
// public/art/ as static files (not imported through Vite) since they're
// fixed content, not build assets that ever change.
export interface Artwork {
  id: string;
  title: string;
  year: string;
  /** Root-relative path into public/art/ — the site has no Vite base path. */
  image: string;
  /** The piece's own ArtStation page, for "open full size" / attribution. */
  url: string;
}

export const ARTSTATION_URL = "https://www.artstation.com/williamshiao";

export const artworks: Artwork[] = [
  {
    id: "scythe-contest",
    title: "Scythe Design Contest Entry - FFXIV",
    year: "2024",
    image: "/art/scythe-contest.jpg",
    url: "https://www.artstation.com/artwork/5vLPGE",
  },
  {
    id: "jinx",
    title: "Jinx",
    year: "2021",
    image: "/art/jinx.jpg",
    url: "https://www.artstation.com/artwork/18yYxG",
  },
  {
    id: "fantasy-forest",
    title: "Fantasy Forest background",
    year: "2021",
    image: "/art/fantasy-forest.jpg",
    url: "https://www.artstation.com/artwork/lxnJ05",
  },
  {
    id: "red-samurai",
    title: "Red Samurai",
    year: "2020",
    image: "/art/red-samurai.jpg",
    url: "https://www.artstation.com/artwork/184LeG",
  },
  {
    id: "huh",
    title: "Huh?",
    year: "2020",
    image: "/art/huh.jpg",
    url: "https://www.artstation.com/artwork/0nDoZy",
  },
  {
    id: "spider-gwen-2019",
    title: "Spider Gwen 2019",
    year: "2019",
    image: "/art/spider-gwen-2019.jpg",
    url: "https://www.artstation.com/artwork/dO6dnw",
  },
  {
    id: "spider-gwen",
    title: "Spider-Gwen",
    year: "2019",
    image: "/art/spider-gwen.jpg",
    url: "https://www.artstation.com/artwork/KaRO4X",
  },
  {
    id: "haunted",
    title: "Haunted",
    year: "2020",
    image: "/art/haunted.jpg",
    url: "https://www.artstation.com/artwork/9mzkZo",
  },
  {
    id: "infernal-amumu",
    title: "Infernal Amumu",
    year: "2021",
    image: "/art/infernal-amumu.jpg",
    url: "https://www.artstation.com/artwork/3dkA2D",
  },
  {
    id: "future-tracer",
    title: "Future Tracer",
    year: "2020",
    image: "/art/future-tracer.jpg",
    url: "https://www.artstation.com/artwork/xJwZv1",
  },
  {
    id: "katarina",
    title: "Katarina",
    year: "2021",
    image: "/art/katarina.jpg",
    url: "https://www.artstation.com/artwork/18GAqK",
  },
  {
    id: "nier-2b",
    title: "Nier Automata's 2B",
    year: "2017",
    image: "/art/nier-2b.jpg",
    url: "https://www.artstation.com/artwork/4qKA2",
  },
];
