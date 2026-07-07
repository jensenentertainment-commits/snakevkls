import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AskBorre from "@/app/components/AskBorre";
import SnakeNav from "@/app/components/SnakeNav";
import SnakeFooter from "@/app/components/SnakeFooter";

export default async function BorreProPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <main className="min-h-screen bg-[#062f3b] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">
        <SnakeNav />

        <header className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#b58a14]">
            Børre Pro
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">
            Børres kontor
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65">
            Her hjelper Børre med utviklingen av Snake. Diskuter nye moduler,
            arbeidsflyt, database, brukeropplevelse og prioriteringer. Dette er
            utviklingsrommet – ikke lagergulvet.
          </p>
        </header>

        <div className="mt-5">
          <AskBorre mode="page" variant="pro" />
        </div>

        <SnakeFooter />
      </div>
    </main>
  );
}