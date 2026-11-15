import Link from "next/link";
export default function RetiredCleanupPage() {
 return <section className="rounded-snake-card bg-snake-surface p-6">
 <h1 className="text-2xl font-semibold">Ryddemodus er pensjonert</h1>
 <p className="mt-3">Bruk produktvisningen for å registrere eller endre en konkret plassering.</p>
 <Link className="mt-4 inline-block text-snake-link" href="/products">Åpne produkter</Link></section>;
}
