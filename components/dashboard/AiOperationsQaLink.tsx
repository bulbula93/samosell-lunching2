// Stable branch alias: Production navigation must never enable the QA database reader.
const QA_ADMIN_URL = "https://samosell-lunching2-git-prev-f37447-giorgibulbula-6265s-projects.vercel.app/admin/ai"

export default function AiOperationsQaLink({ className }: { className?: string }) {
  return (
    <a
      href={QA_ADMIN_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? "whitespace-nowrap rounded-full border border-brand/20 bg-brand-soft px-4 py-2 text-sm font-semibold text-brand"}
      aria-label="AI Operations · QA — ახალ ჩანართში გახსნა"
    >
      AI Operations · QA <span aria-hidden="true">↗</span>
    </a>
  )
}
