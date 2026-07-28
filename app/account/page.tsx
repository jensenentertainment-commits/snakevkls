import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChangePasswordCard from "../components/settings/ChangePasswordCard";
import AccountProfileCard from "../components/account/AccountProfileCard";
import { isRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, active")
    .eq("id", user.id)
    .single();

  if (!profile?.active || !isRole(profile.role)) {
    redirect("/login?error=access_denied");
  }

  const { data: activity } = await supabase
    .from("activity_log")
    .select(`
      id,
      title,
      description,
      created_at
    `)
    .eq("actor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <section className="overflow-hidden rounded-[28px] bg-[#e8eef0] text-neutral-950 shadow-2xl shadow-black/30">
          <div className="border-b border-black/10 bg-[#05495b] px-8 py-8 text-white sm:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
              Snake / Konto
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">
              Brukerprofil
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              Administrer brukerprofil, passord og se din aktivitet i Snake.
            </p>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_420px]">
            <div className="space-y-5">
              <AccountProfileCard
                displayName={profile?.display_name ?? ""}
                email={user.email ?? ""}
                role={profile.role}
              />

              <ChangePasswordCard />
            </div>

            <section className="rounded-[24px] border border-black/10 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-neutral-950">
                Min aktivitet
              </h2>

              <div className="mt-5 space-y-3">
                {activity?.length ? (
                  activity.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-black/10 bg-neutral-50 p-4"
                    >
                      <p className="text-sm font-semibold text-neutral-950">
                        {item.title}
                      </p>

                      {item.description && (
                        <p className="mt-1 text-sm text-neutral-600">
                          {item.description}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-neutral-400">
                        {new Date(item.created_at).toLocaleString("nb-NO")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-neutral-500">
                    Ingen aktivitet registrert ennå.
                  </p>
                )}
              </div>
            </section>
          </div>
    </section>
  );
}
