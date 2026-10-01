"use client";

import { useRouter } from "next/navigation";

export function BotonSalir() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/session", { method: "DELETE" });
        router.replace("/");
        router.refresh();
      }}
      className="text-sm underline underline-offset-4"
    >
      Cerrar sesión
    </button>
  );
}
