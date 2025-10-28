"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { signIn } from "next-auth/react";
import VKIDButton from "./VKIDButton";

type Tab = "login" | "register";

export default function AuthDialog({
  open,
  onOpenChange,
  initialTab = "login",
  appId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab?: Tab;
  appId: number;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [tab]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[999] flex items-center justify-center"
      onMouseDown={(e) => e.target === e.currentTarget && onOpenChange(false)}
      onWheelCapture={(e) => e.preventDefault()}
      onTouchMoveCapture={(e) => e.preventDefault()}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto"
        onWheel={(e) => e.stopPropagation()}
        onTouchMoveCapture={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-2 rounded-xl bg-neutral-100 p-1">
            <button
              onClick={() => setTab("login")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === "login" ? "bg-white shadow" : "text-neutral-600"}`}
            >
              Вход
            </button>
            <button
              onClick={() => setTab("register")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === "register" ? "bg-white shadow" : "text-neutral-600"}`}
            >
              Регистрация
            </button>
          </div>
          <button
            aria-label="Закрыть"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-2 hover:bg-black/5"
          >
            ✕
          </button>
        </div>

        {tab === "login" ? (
          <LoginForm
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            loading={loading}
            setLoading={setLoading}
            error={error}
            setError={setError}
            appId={appId}
          />
        ) : (
          <RegisterForm
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            loading={loading}
            setLoading={setLoading}
            error={error}
            setError={setError}
          />
        )}

        <p className="mt-4 text-center text-xs text-neutral-500">
          Нажимая кнопку, вы соглашаетесь с правилами сайта и политикой конфиденциальности.
        </p>
      </div>
    </div>,
    document.body
  );
}

function LoginForm(props: {
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  loading: boolean; setLoading: (v: boolean) => void;
  error: string | null; setError: (v: string | null) => void;
  appId: number;
}) {
  const { email, setEmail, password, setPassword, loading, setLoading, error, setError, appId } = props;
  const [mode, setMode] = useState<"login" | "recover">("login");
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false, callbackUrl: "/" });
    setLoading(false);
    if (!res || res.error) setError("Неверный email или пароль");
    else if (res.ok) window.location.href = res.url || "/";
  }

  async function onRecover(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setLoading(true);
    try {
      const r = await fetch("/api/password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => null);
        setError(data?.error ?? "Не удалось отправить письмо. Попробуйте позже.");
        return;
      }
      setOk(true);
    } finally {
      setLoading(false);
    }
  }

  const hasAppId = useMemo(() => Number.isFinite(appId) && appId > 0, [appId]);

  if (mode === "recover") {
    return (
      <div>
        <form onSubmit={onRecover} className="space-y-3">
          <input className="w-full rounded-lg border px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {ok && <p className="text-sm text-green-700">Если такой аккаунт существует, мы отправили письмо с инструкциями.</p>}
          <button className="w-full rounded-lg bg-black py-2 text-white disabled:opacity-50" disabled={loading}>
            {loading ? "Отправляем…" : "Восстановить доступ"}
          </button>
        </form>
        <div className="mt-3 text-center">
          <button className="text-sm text-black/70 underline underline-offset-4" onClick={()=>setMode("login")}>Вернуться ко входу</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded-lg border px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        <input className="w-full rounded-lg border px-3 py-2" type="password" placeholder="Пароль" value={password} onChange={(e)=>setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded-lg bg-black py-2 text-white disabled:opacity-50" disabled={loading}>
          {loading ? "Входим…" : "Войти"}
        </button>
      </form>

      <div className="mt-3 text-center">
        <button className="text-sm text-black/70 underline underline-offset-4" onClick={()=>setMode("recover")}>Забыли пароль?</button>
      </div>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-black/10" />
        <span className="text-xs uppercase tracking-wide text-black/60">или</span>
        <div className="h-px flex-1 bg-black/10" />
      </div>

      {hasAppId ? (
        <VKIDButton appId={appId} className="w-full" />
      ) : (
        <p className="text-center text-sm text-red-600">AUTH_VK_ID не задан на сервере</p>
      )}
    </div>
  );
}

function RegisterForm(props: {
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  loading: boolean; setLoading: (v: boolean) => void;
  error: string | null; setError: (v: string | null) => void;
}) {
  const { name, setName, email, setEmail, password, setPassword, loading, setLoading, error, setError } = props;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || name.trim().length < 2) {
      setError("Укажите имя (минимум 2 символа)");
      return;
    }
    if (!password || password.length < 8) {
      setError("Пароль должен быть не короче 8 символов");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name.trim(), password }),
      });
      if (res.status === 409) {
        setError("Такой email уже зарегистрирован. Войдите или восстановите пароль.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Не удалось создать аккаунт. Попробуйте позже.");
        return;
      }
      const loginRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/",
      });
      if (loginRes?.ok) {
        window.location.href = loginRes.url || "/";
      } else {
        setError("Аккаунт создан. Теперь войдите с вашим паролем.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input className="w-full rounded-lg border px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
      <input className="w-full rounded-lg border px-3 py-2" type="text" placeholder="Имя (публично)" value={name} onChange={(e)=>setName(e.target.value)} minLength={2} required />
      <input className="w-full rounded-lg border px-3 py-2" type="password" placeholder="Пароль (мин. 8 символов)" value={password} onChange={(e)=>setPassword(e.target.value)} minLength={8} required />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="w-full rounded-lg bg-black py-2 text-white disabled:opacity-50" disabled={loading}>
        {loading ? "Создаём…" : "Зарегистрироваться"}
      </button>
    </form>
  );
}
