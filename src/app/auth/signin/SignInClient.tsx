"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import VKIDButton from "@/app/components/VKIDButton";

export default function SignInClient({ appId }: { appId: number }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/",
    });
    setLoading(false);
    if (res?.ok) window.location.href = res.url || "/";
    else setErr("Неверный email или пароль");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm border rounded-2xl p-6 space-y-6">
        <h1 className="text-xl font-semibold">Вход</h1>

        <VKIDButton appId={appId} />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-neutral-500">или по почте</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full border rounded p-2"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full border rounded p-2"
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            className="w-full rounded bg-black text-white py-2 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
