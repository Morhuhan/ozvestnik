// app/(site)/components/PopularSections.tsx

import { prisma } from "../../../lib/db";
import PopularSectionsBar from "./PopularSectionsBar";

export default async function PopularSections() {
  const groups = await prisma.article.groupBy({
    by: ["sectionId"],
    where: { status: "PUBLISHED", sectionId: { not: null as any } },
    _count: { sectionId: true },
  });

  const ids = groups.map((g) => g.sectionId as string);
  if (ids.length === 0) return null;

  const sections = await prisma.section.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, name: true },
  });

  const map = new Map(groups.map((g) => [String(g.sectionId), g._count.sectionId]));
  const ranked = sections
    .map((s) => ({ id: s.id, slug: s.slug, name: s.name, count: map.get(s.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return <PopularSectionsBar sections={ranked} />;
}
