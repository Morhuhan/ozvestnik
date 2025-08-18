"use client"

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react"

type Toast = {
  id: number
  title?: string
  description?: string
  type?: "success" | "error" | "info"
  duration?: number
}

type Ctx = { toast: (t: Omit<Toast, "id">) => void }

const ToastCtx = createContext<Ctx | null>(null)

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx.toast
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++nextId.current
    const item: Toast = { id, type: "info", duration: 3500, ...t }
    setToasts((prev) => [...prev, item])
    if (item.duration && item.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id))
      }, item.duration)
    }
  }, [])

  function remove(id: number) {
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`min-w-[260px] max-w-sm rounded-lg border p-3 shadow bg-white
              ${t.type === "success" ? "border-green-200" : ""}
              ${t.type === "error" ? "border-red-200" : ""}
            `}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-2 h-2 w-2 rounded-full
                  ${t.type === "success" ? "bg-green-500" : t.type === "error" ? "bg-red-500" : "bg-gray-400"}
                `}
              />
              <div className="flex-1">
                {t.title && <div className="font-medium">{t.title}</div>}
                {t.description && <div className="text-sm opacity-80">{t.description}</div>}
              </div>
              <button onClick={() => remove(t.id)} className="text-sm opacity-60 hover:opacity-100">
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
