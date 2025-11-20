"use client";

import { useEffect, useRef } from "react";
import { signIn } from "next-auth/react";

type VKIDNS = typeof import("@vkid/sdk");

function getPublicBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }
  const fromEnv =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_VK_REDIRECT_URI ||
    "https://xn----dtbhcghdehg5ad2aogq.xn--p1ai";
  return fromEnv.replace(/\/+$/, "");
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

        const origin: string = getPublicBaseUrl();

        VKID.Config.init({
          app: Number(appId),
          redirectUrl: origin,
          responseMode: VKID.ConfigResponseMode.Callback,
          mode: VKID.ConfigAuthMode.InNewWindow,
          scope: "vkid.personal_info",
        });

        const el = boxRef.current;
        if (!el) return;
        el.innerHTML = "";

        const widget = new VKID.OneTap()
          .render({ container: el, showAlternativeLogin: false })
          .on(VKID.WidgetEvents.ERROR, (e: unknown) => {
            console.error("[VKID] widget error:", e);
            alert(`Ошибка виджета VK ID: ${e}`);
          })
          .on(
            VKID.OneTapInternalEvents.LOGIN_SUCCESS,
            async (payload: any) => {
              try {
                const code: string | undefined = payload?.code;
                const deviceId: string | undefined = payload?.device_id;

                if (!code || !deviceId) {
                  console.error("[VKID] Missing payload parameters");
                  alert("Ошибка входа через VK ID: не получены необходимые данные.");
                  return;
                }

                const res = await VKID.Auth.exchangeCode(code, deviceId).catch((e) => {
                    console.error("[VKID] exchangeCode error:", e);
                    return null;
                });

                if (!res?.access_token || !res?.user_id) {
                  console.error("[VKID] Invalid exchange result", res);
                  alert("Ошибка входа через VK ID: не удалось обменять код на токен.");
                  return;
                }

                const result = await signIn("vkid", {
                  accessToken: res.access_token,
                  userId: String(res.user_id),
                  redirect: false,
                  callbackUrl: "/",
                });

                if (result?.ok) {
                  window.location.href = result.url || "/";
                } else {
                  console.error("[VKID] signIn failed:", result?.error);
                  alert(`Ошибка входа: ${result?.error || "неизвестная ошибка"}`);
                }
              } catch (err) {
                console.error("[VKID] login flow error:", err);
                alert(`Произошла непредвиденная ошибка при входе: ${err}`);
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
        alert(`Не удалось инициализировать виджет VK ID: ${err}`);
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