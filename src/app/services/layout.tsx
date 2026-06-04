"use client";

import { ServicesAuthProvider } from "@/lib/ServicesAuthProvider";

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <ServicesAuthProvider>{children}</ServicesAuthProvider>;
}
