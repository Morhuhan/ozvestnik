"use client";

import { useState } from "react";
import AuthDialog from "./AuthDialog";

export default function AuthLauncherButton({ appId }: { appId: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="-my-3 rounded-md px-4 py-3 text-neutral-900 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
      >
        Войти
      </button>
      <AuthDialog open={open} onOpenChange={setOpen} initialTab="login" appId={appId} />
    </>
  );
}
