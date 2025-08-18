"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useToast } from "./ToastProvider"

export function SearchParamToaster() {
  const sp = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    if (!sp) return
    const err = sp.get("error")
    const ok = sp.get("toast") || sp.get("success")

    if (err) toast({ type: "error", title: err })
    if (ok) toast({ type: "success", title: ok })

    if (err || ok) {
      const params = new URLSearchParams(sp.toString())
      params.delete("error")
      params.delete("toast")
      params.delete("success")
      const url = params.toString() ? `${pathname}?${params}` : pathname
      router.replace(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp?.toString()])

  return null
}
