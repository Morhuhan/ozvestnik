// src/app/api/register/request/route.ts
import { NextResponse } from "next/server"
import { z } from "zod"
import crypto from "node:crypto"
import { prisma } from "../../../../../lib/db"

const Schema = z.object({
  email: z.email(),                    // ← было z.string().email()
  name: z.string().min(2).max(100).optional(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, name } = Schema.parse(body)

    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30)

    await prisma.emailToken.deleteMany({ where: { email } })
    await prisma.emailToken.create({
      data: { email, name, token, role: "READER", expiresAt },
    })

    const base = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const verifyUrl = `${base}/register/verify?token=${token}`

    if (!process.env.EMAIL_SERVER) {
      console.log("\n=== Registration link ===\n", verifyUrl, "\nДля:", email, "\n")
    } else {
      // динамический импорт, чтобы не тянуть типы зря
      const nodemailer = await import("nodemailer")
      const transporter = nodemailer.createTransport(process.env.EMAIL_SERVER as any)
      await transporter.sendMail({
        to: email,
        from: process.env.EMAIL_FROM || "no-reply@localhost",
        subject: "Подтверждение регистрации",
        text: `Перейдите по ссылке: ${verifyUrl}`,
        html: `<p>Завершите регистрацию: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }
}
