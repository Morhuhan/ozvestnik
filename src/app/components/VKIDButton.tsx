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

        const redirectUrl = window.location.origin;

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

                // 1. Обмениваем код на токен
                const authResult = await VKID.Auth.exchangeCode(code, deviceId).catch((e) => {
                    console.error("[VKID] exchangeCode error:", e);
                    return null;
                });

                if (!authResult?.access_token || !authResult?.user_id) {
                  console.error("[VKID] Invalid exchange result", authResult);
                  return;
                }

                // 2. Получаем данные пользователя через правильный endpoint VK ID
                const userInfoUrl = "https://id.vk.ru/oauth2/user_info";
                const formData = new URLSearchParams();
                formData.append("access_token", authResult.access_token);
                formData.append("client_id", String(appId));

                const userInfoResponse = await fetch(userInfoUrl, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: formData.toString(),
                  cache: "no-store",
                });

                const userInfoData = await userInfoResponse.json();

                // ДЛЯ ОТЛАДКИ
                console.log("[VKID] User info response:", userInfoData);

                if (userInfoData?.error) {
                  console.error("[VKID] user_info error:", userInfoData.error_description);
                  return;
                }

                const vkUser = userInfoData?.user;
                if (!vkUser?.user_id) {
                  console.error("[VKID] Empty user data");
                  return;
                }
                
                // 3. Собираем все данные для отправки на сервер
                const userData = {
                  userId: String(vkUser.user_id),
                  name: [vkUser.first_name, vkUser.last_name].filter(Boolean).join(" ").trim() || `VK пользователь ${vkUser.user_id}`,
                  email: vkUser.email || null,
                  image: vkUser.avatar || null,
                };

                // 4. Вызываем signIn, передавая все данные
                const result = await signIn("vkid", {
                  accessToken: authResult.access_token,
                  ...userData,
                  redirect: false,
                  callbackUrl: "/",
                });

                if (result?.ok) {
                  window.location.href = result.url || "/";
                } else {
                  console.error("[VKID] signIn failed:", result?.error);
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