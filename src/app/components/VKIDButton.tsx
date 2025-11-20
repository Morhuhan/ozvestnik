"use client";

import { useEffect, useRef } from "react";
import { signIn } from "next-auth/react";

type VKIDNS = typeof import("@vkid/sdk");

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

        // redirectUrl должен быть корнем вашего сайта для CORS
        const redirectUrl = window.location.origin;

        VKID.Config.init({
          app: Number(appId),
          redirectUrl: redirectUrl,
          responseMode: VKID.ConfigResponseMode.Callback, // Используем callback
          mode: VKID.ConfigAuthMode.InNewWindow, // Открываем в новом окне/вкладке
          scope: "vkid.personal_info,email", // Запрашиваем email
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

                // Обмениваем код на токен на клиенте
                const res = await VKID.Auth.exchangeCode(code, deviceId).catch((e) => {
                    console.error("[VKID] exchangeCode error:", e);
                    return null;
                });

                if (!res?.access_token || !res?.user_id) {
                  console.error("[VKID] Invalid exchange result", res);
                  return;
                }

                // Вызываем signIn из next-auth/react, который передаст данные в наш провайдер
                const result = await signIn("vkid", {
                  accessToken: res.access_token,
                  userId: String(res.user_id),
                  redirect: false, // Не редиректим автоматически, а сделаем это вручную
                  callbackUrl: "/",
                });

                if (result?.ok) {
                  // Если все прошло успешно, перезагружаем страницу или редиректим
                  window.location.href = result.url || "/";
                } else {
                  console.error("[VKID] signIn failed:", result?.error);
                  // Здесь можно показать ошибку пользователю
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