import type { ReactNode } from "react";

import { WarehouseSalesProvider } from "@/app/components/warehouse-sales";

export default function WarehouseSalesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <WarehouseSalesProvider>{children}</WarehouseSalesProvider>;
}
