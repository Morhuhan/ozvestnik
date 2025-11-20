"use client";

import { useEffect, useRef } from "react";
import { signIn } from "next-auth/react";

type VKIDNS = typeof import("@vkid/sdk");

function getRedirectUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin.replace(/\/+$/, "")}/api/auth/callback/vkid`;
  }
  return process.env.NEXT_PUBLIC_AUTH_VK_REDIRECT_URI || "https://xn----dtbhcghdehg5ad2aogq.xn--p1ai/api/auth/callback/vkid";
}

export default function VKIDButton({
  appId,
  className = "",
}: {
  appId: number;
  className?: string;
}) {
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

        const redirectUrl = getRedirectUrl();

        VKID.Config.init({
          app: Number(appId),
          redirectUrl: redirectUrl,
          responseMode: VKID.ConfigResponseMode.Callback,
          mode: VKID.ConfigAuthMode.InNewWindow,
          scope: "vkid.personal_info,email",
        });

        const el = boxRef.current;
        if (!el) return;
        el.innerHTML = "";

        const widget = new VKID.OneTap()
          .render({ 
            container: el, 
            showAlternativeLogin: false,
            scheme: VKID.Scheme.LIGHT,
            lang: VKID.Languages.RUS,
            contentId: VKID.OneTapContentId.SIGN_IN,
          })
          .on(VKID.WidgetEvents.ERROR, (e: unknown) => {
            console.error("[VKID] widget error:", e);
          })
          .on(
            VKID.OneTapInternalEvents.LOGIN_SUCCESS,
            async (payload: any) => {
              try {
                const code: string | undefined = payload?.code;
                const deviceId: string | undefined = payload?.device_id;

                if (!code || !deviceId) {
                  console.error("[VKID] Missing payload parameters", payload);
                  return;
                }

                const res = await VKID.Auth.exchangeCode(code, deviceId).catch((e) => {
                    console.error("[VKID] exchangeCode error:", e);
                    return null;
                });

                if (!res?.access_token || !res?.user_id) {
                  console.error("[VKID] Invalid exchange result", res);
                  return;
                }

                // Отправляем данные на наш callback обработчик
                const response = await fetch('/api/auth/callback/vkid', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    accessToken: res.access_token,
                    userId: String(res.user_id),
                  }),
                });

                if (response.ok) {
                  // Если обработка прошла успешно, перенаправляем на главную
                  window.location.href = "/";
                } else {
                  console.error("[VKID] callback failed");
                }
              } catch (err) {
                console.error("[VKID] login flow error:", err);
              }
            }
          );

        cleanup = () => {
          try {
            (widget as any)?.destroy?.();
          } catch {}
          if (boxRef.current) boxRef.current.innerHTML = "";
        };
      } catch (err) {
        console.error("[VKID] init failed:", err);
      }
    })();

    return cleanup;
  }, [appId]);

  return (
    <div className={className}>
      <div ref={boxRef} />
    </div>
  );
}