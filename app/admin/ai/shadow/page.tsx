import { readQaOperations } from "@/lib/ai-ops/qa-reader";
import { AiNavigation, QaStatus } from "../qa-status";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "AI Shadow Monitor | SamoSell",
  robots: { index: false, follow: false },
};

export default async function ShadowMonitorPage() {
  const result = await readQaOperations();
  return (
    <main className="ui-container ui-section space-y-5">
      <header className="ui-card p-5 sm:p-8">
        <p className="ui-eyebrow">AI Operations · Foundation v0.5</p>
        <h1 className="mt-3 text-3xl font-black text-text">
          დაკვირვების რეჟიმი
        </h1>
        <p className="mt-3 text-sm leading-7 text-text-soft">
          Shadow Worker ჯერ არ მუშაობს. აქ ჩანს მხოლოდ SamoSell-QA-ში შენახული
          დავალებების მდგომარეობა.
        </p>
      </header>
      <AiNavigation />
      <QaStatus result={result} />
      {result.ok && (
        <section className="ui-card p-5 sm:p-6">
          <h2 className="text-xl font-bold text-text">QA დაკვირვება</h2>
          <p className="mt-3 text-sm text-text-soft">
            რიგში სულ {result.data.totals.jobs} დავალებაა; ჟურნალში{" "}
            {result.data.totals.activity} მოვლენაა. განახლება მხოლოდ კითხულობს
            ბაზას და ახალ Job-ს არ ქმნის.
          </p>
          <p className="mt-3 text-sm text-text-soft">
            მომხმარებლების, მხარდაჭერის შეტყობინებებისა და გადახდების სკანირება
            ამ Preview-ში არ სრულდება.
          </p>
        </section>
      )}
    </main>
  );
}
