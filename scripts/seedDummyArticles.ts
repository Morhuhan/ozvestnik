// scripts/seedDummyArticles.ts
import { PrismaClient, Status } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("▶️ Seeding dummy articles...");

  const section = await prisma.section.upsert({
    where: { slug: "test-section" },
    update: {},
    create: { name: "Тестовый раздел", slug: "test-section", order: 0 },
    select: { id: true, slug: true },
  });

  for (let i = 1; i <= 100; i++) {
    await prisma.article.upsert({
      where: { slug: `test-article-${i}` },
      update: {},
      create: {
        title: `Тестовая статья №${i}`,
        slug: `test-article-${i}`,
        subtitle: `Это заглушка для тестирования бесконечной ленты (${i})`,
        status: Status.PUBLISHED,
        publishedAt: new Date(Date.now() - i * 3600 * 1000),
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: `Контент тестовой статьи №${i}` }],
            },
          ],
        } as any, // если strict тип Json ругается — можно ослабить
        section: { connect: { id: section.id } },
      },
    });
    if (i % 10 === 0) console.log(`  ...${i}/100`);
  }

  console.log("✅ Done seeding 100 dummy articles.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
