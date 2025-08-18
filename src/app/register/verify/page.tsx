"use client"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { signIn } from "next-auth/react"

export default function VerifyRegisterPage() {
  const sp = useSearchParams()
  const token = sp.get("token") || ""
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setLoading(true)
    const res = await fetch("/api/register/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json().catch(()=> ({}))
    if (!res.ok) {
      setLoading(false)
      setErr(data?.error || "Не удалось завершить регистрацию")
      return
    }
    // сразу логиним и перекидываем на главную
    const login = await signIn("credentials", { email: data.email, password, redirect: false, callbackUrl: "/" })
    setLoading(false)
    if (login?.ok) window.location.href = login.url || "/"
    else setErr("Не удалось войти")
  }

  if (!token) {
    return <div className="p-6 text-center">Токен не найден</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm border rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">Задайте пароль</h1>
        <input className="w-full border rounded p-2" type="password"
               placeholder="Пароль (мин. 8 символов)" minLength={8}
               value={password} onChange={e=>setPassword(e.target.value)} required />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button className="w-full rounded bg-black text-white py-2" disabled={loading}>
          {loading ? "Сохраняем..." : "Завершить регистрацию"}
        </button>
      </form>
    </div>
  )
}
