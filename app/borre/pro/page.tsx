import { AI_ASSISTANTS_ENABLED } from "@/lib/intelligence/assistant-availability";
import { redirect, permanentRedirect } from "next/navigation";

export default function LegacyBorreProPage() {
  if (!AI_ASSISTANTS_ENABLED) redirect("/lager");
  permanentRedirect("/arne");
}
