export default async function SavedPlan({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main className="mx-auto max-w-2xl p-8">Sparad plan {token} (steg 5).</main>;
}
