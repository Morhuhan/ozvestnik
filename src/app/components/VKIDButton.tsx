// src/app/components/auth/VKIDButton.tsx
"use client";

import { useEffect, useRef } from "react";
import { signIn } from "next-auth/react";

type VKIDNS = typeof import("@vkid/sdk");

export default function VKIDButton({ appId, className = "" }: { appId: number; className?: string }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inited = useRef(false);

  useEffect(() => {
    if (!appId || inited.current) return;
    inited.current = true;

    let cleanup = () => {
      if (boxRef.current) boxRef.current.innerHTML = "";
      inited.current = false;
    };

    (async () => {
      try {
        const VKID: VKIDNS = await import("@vkid/sdk");

        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : (process.env.NEXTAUTH_URL || "https://localhost");

        VKID.Config.init({
          app: Number(appId),
          redirectUrl: origin, // для callback-режима
          responseMode: VKID.ConfigResponseMode.Callback,
          mode: VKID.ConfigAuthMode.InNewWindow, // <— КЛЮЧЕВАЯ СТРОКА (popup-окно вместо вкладки)
          scope: "vkid.personal_info",
        });

        const el = boxRef.current;
        if (!el) return;
        el.innerHTML = "";

        const widget = new VKID.OneTap()
          .render({ container: el, showAlternativeLogin: false })
          .on(VKID.WidgetEvents.ERROR, (e: any) => {
            console.debug("[VKID] widget event (suppressed):", e);
          })
          .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, async (payload: any) => {
            try {
              const code = payload?.code;
              const deviceId = payload?.device_id;
              if (!code || !deviceId) return;

              const res = await VKID.Auth.exchangeCode(code, deviceId).catch(() => null);
              if (!res?.access_token || !res?.user_id) return;

              const out = await signIn("vkid", {
                accessToken: res.access_token,
                userId: String(res.user_id),
                redirect: false,
                callbackUrl: "/",
              });
              if (out?.ok) window.location.href = out.url || "/";
            } catch (err) {
              console.debug("[VKID] login flow error (suppressed):", err);
            }
          });

        cleanup = () => {
          try { (widget as any)?.destroy?.(); } catch {}
          if (boxRef.current) boxRef.current.innerHTML = "";
        };
      } catch (err) {
        console.debug("[VKID] init failed (suppressed):", err);
      }
    })();

    return cleanup;
  }, [appId]);

  return <div className={className}><div ref={boxRef} /></div>;
}
