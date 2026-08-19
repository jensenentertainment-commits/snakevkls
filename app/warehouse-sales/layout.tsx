import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { WarehouseSalesProvider } from "@/app/components/warehouse-sales";
import { requireRole } from "@/lib/auth/require-role";

export default async function WarehouseSalesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const auth = await requireRole(["admin", "user"]);
  if (!auth.ok) {
    redirect(auth.response.status === 401 ? "/login" : "/dashboard");
  }

  return <WarehouseSalesProvider>{children}</WarehouseSalesProvider>;
}
