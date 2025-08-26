export function extractInlineMediaIdsFromContent(content: any): string[] {
  const acc: string[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "image" && node.attrs?.["data-media-id"]) {
      acc.push(String(node.attrs["data-media-id"]));
    }
    const kids = node.content as any[] | undefined;
    kids?.forEach(walk);
  };
  walk(content);
  // уникализируем
  return Array.from(new Set(acc));
}
