import ProfileForm from "@/components/dashboard/ProfileForm"

export const dynamic = "force-dynamic"

export default function StoreProfileSetupPreviewPage() {
  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="border-b border-line bg-white">
        <div className="ui-container flex h-16 items-center justify-between">
          <div className="text-xl font-black tracking-tight">samo$ell</div>
          <div className="ui-pill bg-surface-alt text-text-soft">UI Preview • DB გამორთულია</div>
        </div>
      </div>
      <section className="ui-container py-8 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 rounded-[1.5rem] border border-brand/15 bg-brand-soft/35 p-5 sm:p-6">
            <div className="ui-eyebrow">Design preview</div>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">მაღაზიის პროფილის Setup — Preview</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-soft">
              ეს გვერდი მხოლოდ დიზაინის სანახავადაა. შეგიძლია ატვირთო ლოგო და banner, შეცვალო ტექსტები და მაშინვე ნახო შედეგი. არაფერი ინახება Supabase-ში და Production მონაცემებს არ ეხება.
            </p>
          </div>

          <ProfileForm
            previewOnly
            userId="preview-store-user"
            initialProfile={{
              username: "my-store",
              full_name: "ჩემი მაღაზია",
              bio: "აქ დაწერე მაღაზიის მოკლე აღწერა — რას ყიდი, რა სტილია და როგორ მუშაობს მიწოდება.",
              city: "თბილისი",
              avatar_url: "",
              seller_type: "store",
              store_logo_url: "",
              store_banner_url: "",
              store_phone: "",
              store_whatsapp: "",
              store_telegram: "",
              store_instagram: "",
              store_facebook: "",
              store_website: "",
              store_hours: "",
              store_address: "",
              store_map_url: "",
              tiktok_username: "",
              tiktok_live_until: "",
            }}
          />
        </div>
      </section>
    </main>
  )
}
