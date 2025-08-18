// scripts/create-admin.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

(async () => {
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const name = process.env.ADMIN_NAME || "Главный Админ";
  const password = process.env.ADMIN_PASSWORD || "change-me-now";
  if (!password || password.length < 8) throw new Error("ADMIN_PASSWORD не задан или < 8 символов");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", name, passwordHash },
    create: { email, name, role: "ADMIN", passwordHash },
    select: { id: true, email: true, role: true },
  });

  console.log("Администратор:", user);
})().finally(() => prisma.$disconnect());
