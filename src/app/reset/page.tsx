import { Suspense } from "react";
import ResetContent from "./ResetContent";

export const dynamic = "force-dynamic";

export default function ResetPageWrapper() {
  return (
    <Suspense fallback={<div className="text-center p-10">Загрузка...</div>}>
      <ResetContent />
    </Suspense>
  );
}
