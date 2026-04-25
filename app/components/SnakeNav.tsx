import Image from "next/image";
import Link from "next/link";

export default function SnakeNav() {
  return (
    <header className="mb-8 flex items-center justify-between gap-6">
      <Link href="/" className="flex items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] shadow-lg shadow-black/20">
          <Image
            src="/vk_logo2.png"
            alt="Varekompaniet logo"
            width={200}
            height={200}
            className="h-32 w-32 object-contain"
            priority
          />
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/72">
            SNAKE VKLS
          </p>
          <h1 className="text-sm font-bold uppercase tracking-tight text-white">
            Varekompaniets Lagersystem
          </h1>
        </div>
      </Link>

      <nav className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.045] p-1 shadow-lg shadow-black/20 md:flex">
        <NavLink href="/" label="Forside" />
        <NavLink href="/products" label="Produkter" />
        <NavLink href="/locations" label="Lokasjoner" />
        <NavLink href="/issues" label="Avvik" />
      </nav>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full px-4 py-2 text-sm font-semibold text-white/68 transition hover:bg-[color:rgba(75,108,147,0.18)] hover:text-white"
    >
      {label}
    </Link>
  );
}