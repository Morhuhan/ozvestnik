// src/lib/slugify.ts
export function slugify(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u0430-\u044f\u0451-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}


export function textToTiptapJSON(text: string) {
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  return {
    type: "doc",
    content: paras.map(p => ({
      type: "paragraph",
      content: [{ type: "text", text: p }]
    }))
  }
}
