// app/login/page.tsx
"use client"
import { signIn } from "next-auth/react"
import { useState } from "react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const res = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/" })
    if (res?.ok) window.location.href = res.url || "/"
    setLoading(false)
    if (res?.error) setError("Неверный email или пароль")
    else if (res?.ok) window.location.href = res.url || "/admin"
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm border rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">Вход</h1>
        <input className="w-full border rounded p-2" type="email" placeholder="Email"
               value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border rounded p-2" type="password" placeholder="Пароль"
               value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full rounded bg-black text-white py-2 disabled:opacity-50" disabled={loading}>
          {loading ? "Входим..." : "Войти"}
        </button>
        <p className="text-sm text-center mt-2">
          Нет аккаунта? <a href="/register" className="underline">Зарегистрироваться</a>
        </p>
      </form>
    </div>
  )
}
