const translitMap: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
  'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i',
  'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
  'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
  'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch',
  'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
  'э': 'e', 'ю': 'yu', 'я': 'ya',
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D',
  'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh', 'З': 'Z', 'И': 'I',
  'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N',
  'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T',
  'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'C', 'Ч': 'Ch',
  'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '',
  'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
};

function transliterate(text: string): string {
  return text
    .split('')
    .map(char => translitMap[char] || char)
    .join('');
}

export function slugify(input: string, maxLength: number = 100): string {
  let slug = String(input ?? "")
    .trim()
    .split('')
    .map(char => translitMap[char] || char)
    .join('')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength);
    const lastDash = slug.lastIndexOf("-");
    if (lastDash > maxLength / 2) {
      slug = slug.substring(0, lastDash);
    }
  }

  return slug;
}

export function textToTiptapJSON(text: string) {
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return {
    type: "doc",
    content: paras.length
      ? paras.map(p => ({
          type: "paragraph",
          content: [{ type: "text", text: p }]
        }))
      : [{ type: "paragraph" }]
  };
}