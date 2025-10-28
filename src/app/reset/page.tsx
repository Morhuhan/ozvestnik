"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token") || "";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 8) {
      setError("Пароль должен быть не короче 8 символов");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/password/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        setError(data?.error ?? "Не удалось изменить пароль");
        return;
      }
      setOk(true);
      setTimeout(() => router.push("/"), 1500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h1 className="mb-4 text-xl font-semibold">Сброс пароля</h1>
        {ok ? (
          <p className="text-green-700">Пароль успешно изменён. Перенаправляем…</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <input className="w-full rounded-lg border px-3 py-2" type="password" placeholder="Новый пароль (мин. 8 символов)" value={password} onChange={(e)=>setPassword(e.target.value)} minLength={8} required />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="w-full rounded-lg bg-black py-2 text-white disabled:opacity-50" disabled={loading || !token}>
              {loading ? "Сохраняем…" : "Изменить пароль"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
