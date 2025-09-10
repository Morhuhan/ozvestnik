"use client";
import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="-my-3 rounded-md px-4 py-3 text-neutral-900 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
    >
      Выйти
    </button>
  );
}
