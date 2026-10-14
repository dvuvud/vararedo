import { notFound } from "next/navigation";
import { getDictionary, isLang } from "@/lib/i18n";
import { SiteHeader } from "@/components/SiteChrome";
import PlanWizard from "@/components/form/WizardLoader";

export default async function NewPlan({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <>
      <SiteHeader lang={lang} dict={dict} />
      <PlanWizard lang={lang} dict={dict} />
    </>
  );
}
