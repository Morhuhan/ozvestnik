"use client";
import { useState } from "react";

export default function RegisterRequestPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!name || name.trim().length < 2) {
      setErr("Укажите имя (не короче 2 символов) — оно будет видно на сайте.");
      return;
    }

    const res = await fetch("/api/register/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name.trim() }),
    });

    if (res.ok) setSent(true);
    else setErr("Не удалось отправить ссылку. Попробуйте позже.");
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold mb-2">Проверьте почту</h1>
          <p className="text-sm opacity-70">Мы отправили ссылку для завершения регистрации.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm border rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">Регистрация</h1>

        <div className="space-y-1">
          <input
            className="w-full border rounded p-2"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <p className="text-xs opacity-70">Мы пришлём ссылку для подтверждения.</p>
        </div>

        <div className="space-y-1">
          <input
            className="w-full border rounded p-2"
            type="text"
            placeholder="Имя (публично)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            required
          />
          <p className="text-xs opacity-70">
            Ваше имя будет <span className="font-medium">видно на сайте</span> рядом с комментариями и
            другими материалами.
          </p>
        </div>

        {err && <p className="text-red-600 text-sm">{err}</p>}

        <button className="w-full rounded bg-black text-white py-2">Получить ссылку</button>

        <p className="text-sm text-center">
          <p className="text-sm text-center">
            Уже есть аккаунт?{" "}
            <a className="underline" href="/login">
              Войти
            </a>
          </p>
        </p>
      </form>
    </div>
  );
}
