import { prisma } from "../src/lib/db";
import bcrypt from "bcrypt";

async function main() {
  const email = "radionovich.arkadiy@mail.ru";
  const plainPassword = "radionovich";
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name: "Аркадий",
      role: "READER",
      passwordHash,
    },
  });

  console.log("✅ Пользователь создан:");
  console.log(user);
  console.log("Пароль для входа:", plainPassword);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
