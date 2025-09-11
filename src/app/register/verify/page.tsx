import { Suspense } from "react";
import VerifyRegisterClient from "./verify-client";

export const dynamic = "force-dynamic";

export default function VerifyRegisterPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Загрузка…</div>}>
      <VerifyRegisterClient />
    </Suspense>
  );
}
