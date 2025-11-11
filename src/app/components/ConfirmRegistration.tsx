"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function ConfirmRegistration() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmToken = searchParams.get("confirm");

  useEffect(() => {
    if (!confirmToken) return;

    async function run(token: string) {
      try {
        const res = await fetch("/api/register/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          router.replace("/auth/register?error=confirm");
          return;
        }

        const data = await res.json();

        if (!data?.email || !data?.password) {
          router.replace("/auth/login");
          return;
        }

        await signIn("credentials", {
          email: data.email,
          password: data.password,
          callbackUrl: "/",
        });
      } catch (e) {
        router.replace("/auth/login");
      }
    }

    run(confirmToken);
  }, [confirmToken, router]);

  return null;
}
