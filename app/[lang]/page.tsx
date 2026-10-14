import Link from "next/link";

export default async function Landing({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-semibold">Beredd</h1>
      <p className="mt-4">Platshållare för landningssidan (spår B).</p>
      <Link className="mt-6 inline-block underline" href={`/${lang}/plan/new`}>
        Skapa min plan
      </Link>
    </main>
  );
}
