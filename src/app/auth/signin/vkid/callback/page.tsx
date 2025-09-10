"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";

export default function VkidCallback() {
  useEffect(() => {
    const u = new URL(window.location.href);
    const code = u.searchParams.get("code");
    const deviceId = u.searchParams.get("device_id");
    const state = u.searchParams.get("state");

    const storedState = sessionStorage.getItem("vkid_state");
    const codeVerifier = sessionStorage.getItem("vkid_code_verifier");

    if (!code || !deviceId || !state || state !== storedState || !codeVerifier) {
      window.location.replace("/auth/error");
      return;
    }

    signIn("vkid", {
      code,
      deviceId,
      codeVerifier,
      redirect: true,
      callbackUrl: "/",
    });
  }, []);

  return (
    <div className="min-h-[40vh] flex items-center justify-center p-6">
      <p className="text-sm text-neutral-600">Входим через VK ID…</p>
    </div>
  );
}
