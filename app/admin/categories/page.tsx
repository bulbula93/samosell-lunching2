import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import StatCard from "@/components/shared/StatCard"
import { updateAdminCategoryAction } from "./actions"

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    ok?: string | string[]
    error?: string | string[]
  }>
}) {
  const params = (await searchParams) ?? {}
  const ok = typeof params.ok === "string" ? params.ok : ""
  const error = typeof params.error === "string" ? params.error : ""
  const { supabase } = await requireAdminUser("/dashboard")

  const [categoriesResponse, listingsResponse] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, navigation_label, sort_order, is_active, created_at")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase.from("listings").select("category_id").limit(10000),
  ])

  const categories = categoriesResponse.data ?? []
  const listingCounts = new Map<number, number>()
  for (const listing of listingsResponse.data ?? []) {
    listingCounts.set(
      listing.category_id,
      (listingCounts.get(listing.category_id) ?? 0) + 1,
    )
  }

  const activeCount = categories.filter((category) => category.is_active).length
  const inactiveCount = categories.length - activeCount
  const linkedListings = (listingsResponse.data ?? []).length
  const queryError = categoriesResponse.error || listingsResponse.error

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">Admin / Categories</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              კატეგორიების მართვა
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              აქ შეგიძლია შეცვალო კატეგორიის სახელი, navigation label, რიგითობა და აქტიური სტატუსი.
              Slug განზრახ დაბლოკილია, რადგან ის არსებული catalog URL-ებისა და SEO-ს ნაწილია.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/audit" className="ui-btn-secondary">
              Audit Log
            </Link>
            <Link href="/admin" className="ui-btn-secondary">
              ადმინისტრირების მთავარი
            </Link>
          </div>
        </div>
      </section>

      {ok ? (
        <div className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {ok}
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="სულ კატეგორიები" value={categories.length} />
        <StatCard label="აქტიური" value={activeCount} />
        <StatCard label="არააქტიური" value={inactiveCount} />
        <StatCard label="მიბმული განცხადებები" value={linkedListings} />
      </section>

      {queryError ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          კატეგორიების ჩატვირთვა ვერ მოხერხდა: {queryError.message}
        </div>
      ) : null}

      <section className="mt-6 space-y-4">
        {categories.map((category) => (
          <article key={category.id} className="ui-card p-5 sm:p-6">
            <form
              action={updateAdminCategoryAction}
              className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]"
            >
              <input type="hidden" name="categoryId" value={category.id} />

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ui-pill !px-3 !py-1 text-xs">
                    ID {category.id}
                  </span>
                  <span
                    className={
                      category.is_active
                        ? "ui-pill-soft !px-3 !py-1 text-xs"
                        : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                    }
                  >
                    {category.is_active ? "აქტიური" : "არააქტიური"}
                  </span>
                  <span className="rounded-full border border-line bg-surface-alt px-3 py-1 text-xs font-semibold text-text-soft">
                    {listingCounts.get(category.id) ?? 0} განცხადება
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-text">
                      კატეგორიის სახელი
                    </span>
                    <input
                      name="name"
                      defaultValue={category.name}
                      maxLength={80}
                      className="ui-input w-full"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-text">
                      Navigation label
                    </span>
                    <input
                      name="navigationLabel"
                      defaultValue={category.navigation_label ?? ""}
                      maxLength={80}
                      className="ui-input w-full"
                      placeholder={category.name}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-text">
                      Slug — დაცული
                    </span>
                    <input
                      value={category.slug}
                      readOnly
                      className="ui-input w-full cursor-not-allowed bg-surface-alt text-text-soft"
                    />
                    <span className="mt-1 block text-xs leading-5 text-text-soft">
                      Slug-ის შეცვლა ამ პანელიდან განზრახ შეუძლებელია.
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-text">
                      რიგითობა
                    </span>
                    <input
                      type="number"
                      name="sortOrder"
                      defaultValue={category.sort_order}
                      min={0}
                      max={1000}
                      step={1}
                      className="ui-input w-full"
                      required
                    />
                  </label>
                </div>

                <label className="mt-4 flex items-start gap-3 rounded-[1rem] border border-line bg-surface-alt px-4 py-3">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={category.is_active}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-text">
                      აქტიური კატეგორია
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-text-soft">
                      გამორთვის შემდეგ კატეგორია გაქრება ახალი განცხადების ფორმიდან და მთავარ navigation-იდან.
                      უკვე არსებული განცხადებები არ წაიშლება.
                    </span>
                  </span>
                </label>
              </div>

              <div className="rounded-[1.2rem] border border-line bg-surface-alt p-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-text">
                    Admin შენიშვნა
                  </span>
                  <textarea
                    name="adminNote"
                    maxLength={2000}
                    className="min-h-28 w-full rounded-[1rem] border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                    placeholder="რატომ შეიცვალა კატეგორია? (არასავალდებულო)"
                  />
                </label>

                <button className="ui-btn-primary mt-4 w-full">
                  ცვლილებების შენახვა
                </button>

                <p className="mt-3 text-xs leading-5 text-text-soft">
                  ყველა ცვლილება ჩაიწერება Admin Audit Log-ში.
                </p>
              </div>
            </form>
          </article>
        ))}
      </section>
    </main>
  )
}
