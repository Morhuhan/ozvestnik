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
          })
          .on(
            VKID.OneTapInternalEvents.LOGIN_SUCCESS,
            async (payload: any) => {
              try {
                const code: string | undefined = payload?.code;
                const deviceId: string | undefined = payload?.device_id;
                const codeVerifier: string | undefined = payload?.code_verifier;

                if (!code || !deviceId || !codeVerifier) {
                  console.error("[VKID] Missing payload parameters");
                  return;
                }

                const result = await signIn("vkid", {
                  code,
                  deviceId,
                  codeVerifier,
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