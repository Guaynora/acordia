/** URL-friendly identifier: "Canción Bonita" by "Él" -> "cancion-bonita-el". */
export function slugify(...parts: string[]): string {
  return parts
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
