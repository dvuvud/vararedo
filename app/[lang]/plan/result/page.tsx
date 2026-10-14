import { notFound } from "next/navigation";
import { getDictionary, isLang } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ContactList } from "@/components/ContactList";
import ResultView from "@/components/result/ResultLoader";

export default async function Result({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <ResultView lang={lang} dict={dict} contacts={<ContactList dict={dict} />} />
      <SiteFooter dict={dict} />
    </>
  );
}
