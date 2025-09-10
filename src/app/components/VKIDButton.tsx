"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

type VKIDNS = typeof import("@vkid/sdk");

type Props = {
  appId: number;
  className?: string;
};

export default function VKIDButton({ appId, className = "" }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const inited = useRef(false);
  const [error, setError] = useState<string | null>(null);

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

        // ДОЛЖНО 1-в-1 совпадать с "Доверенный redirect URL" в кабинете VK ID
        VKID.Config.init({
          app: Number(appId),
          redirectUrl: "https://localhost",
          responseMode: VKID.ConfigResponseMode.Callback,
          scope: "vkid.personal_info",
        });

        const el = boxRef.current;
        if (!el) return;
        el.innerHTML = "";

        const widget = new VKID.OneTap()
          .render({ container: el, showAlternativeLogin: true })
          .on(VKID.WidgetEvents.ERROR, (raw: any) => {
            const evt = raw?.detail ?? raw ?? {};
            const code = evt.code ?? evt.error_code ?? null;
            const text = evt.text ?? evt.message ?? evt.error_description ?? null;

            // SDK иногда шлёт "пустые" события — не пугаем юзера
            if (!code && !text) {
              console.debug("[VKID] minor widget event:", raw);
              return;
            }
            if (text === "timeout" || code === 0) {
              console.debug("[VKID] widget timeout (non-fatal)");
              return;
            }
            console.error("[VKID] widget error:", raw, "parsed:", { code, text });
            setError(text || "Ошибка VK ID виджета");
          })
          .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, async (payload: any) => {
            try {
              const code = payload?.code;
              const deviceId = payload?.device_id;
              if (!code || !deviceId) {
                setError("Не пришёл code/device_id от VK ID");
                return;
              }

              // Обмен кода на токен ДЕЛАЕТ SDK (правильные URL/PKCE внутри)
              const res = await VKID.Auth.exchangeCode(code, deviceId);
              const accessToken = res?.access_token;
              const userId = res?.user_id;

              if (!accessToken || !userId) {
                console.error("[VKID] exchangeCode empty:", res);
                setError("Не удалось получить токен VK ID");
                return;
              }

              // Отдаём токен и id в наш credentials-провайдер
              const out = await signIn("vkid", {
                accessToken,
                userId: String(userId),
                redirect: false,
                callbackUrl: "/",
              });

              if (out?.ok) window.location.href = out.url || "/";
              else setError(out?.error || "Не удалось войти через VK ID");
            } catch (e) {
              console.error(e);
              setError("Ошибка входа через VK ID");
            }
          });

        cleanup = () => {
          try {
            (widget as any)?.destroy?.();
          } catch {}
          if (boxRef.current) boxRef.current.innerHTML = "";
        };
      } catch (e) {
        console.error("[VKID] init failed:", e);
        setError("Не удалось инициализировать VK ID");
      }
    })();

    return cleanup;
  }, [appId]);

  return (
    <div className={className}>
      <div ref={boxRef} />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
