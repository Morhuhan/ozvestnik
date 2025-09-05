// scripts/seedDummyArticles.ts
import { prisma } from "../lib/db";

async function main() {
  console.log("▶️ Seeding dummy articles...");

  for (let i = 1; i <= 100; i++) {
    await prisma.article.create({
      data: {
        title: `Тестовая статья №${i}`,
        slug: `test-article-${i}`,
        subtitle: `Это заглушка для тестирования бесконечной ленты (${i})`,
        status: "PUBLISHED",
        publishedAt: new Date(Date.now() - i * 3600 * 1000), // каждая статья "старее" на час
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: `Контент тестовой статьи №${i}` }],
            },
          ],
        },
        section: {
          connectOrCreate: {
            where: { slug: "test-section" },
            create: { name: "Тестовый раздел", slug: "test-section" },
          },
        },
      },
    });
  }

  console.log("✅ Done seeding 100 dummy articles.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
