import { redirect } from "next/navigation";

// Previous Dashboard implementation is preserved in LegacyDashboard.tsx.
export default function DashboardPage() {
  redirect("/lager");
}
