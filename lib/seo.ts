import { SITE_DESCRIPTION_KA, SITE_NAME } from "@/lib/site"
import type { CatalogListing } from "@/types/marketplace"

export const GOOGLE_SITE_VERIFICATION = "uQuez09mPR--nX75FjQfxC1lHoSPZ4Kp19VP2rdNhf0"
export const SITE_URL = "https://samosell.ge"

import { INDEXABLE_CATALOG_CATEGORIES, catalogCategoryHref } from "@/lib/catalog-urls"
export { INDEXABLE_CATALOG_CATEGORIES } from "@/lib/catalog-urls"

type CategoryGuide = {
  sections: readonly { title: string; text: string }[]
  faqs: readonly { question: string; answer: string }[]
  related: readonly { href: string; label: string }[]
}

type CategorySeoEntry = { h1: string; title: string; description: string; intro: string; guide: CategoryGuide }

// Titles follow real Search Console queries ("… ონლაინ", "ახალი და მეორადი", "იაფად").
// Guide text is rendered under the listings on the canonical first page only.
export const CATEGORY_SEO = {
  women: {
    h1: "ქალის ტანსაცმელი — ახალი და მეორადი",
    title: "ქალის ტანსაცმელი ონლაინ — ახალი და მეორადი",
    description: "ქალის ახალი და მეორადი ტანსაცმელი ონლაინ: კაბები, ქურთუკები, ჯინსები და აქსესუარები მთელი საქართველოდან. შეადარე ფასები და მიწერე გამყიდველს პირდაპირ.",
    intro: "კაბები, ქურთუკები, ჯინსები და ყოველდღიური სამოსი — ახალი და მეორადი ნივთები ერთ სივრცეში. შეარჩიე ზომა და ფასი ან გაყიდე ნივთები შენი გარდერობიდან.",
    guide: {
      sections: [
        { title: "როგორ შეარჩიო ქალის ტანსაცმელი ონლაინ", text: "ყოველ განცხადებაში მითითებულია ზომა, მდგომარეობა და ქალაქი. სანამ გამყიდველს მისწერ, შეადარე ზომა შენს საყვარელ ნივთს და ფოტოებზე დააკვირდი ქსოვილს, ღილებსა და ნაკერებს. თუ დეტალი არ ჩანს, ითხოვე დამატებითი ფოტო ჩატში." },
        { title: "ახალი თუ მეორადი?", text: "SamoSell-ზე იყიდება როგორც ახალი, ეტიკეტიანი ნივთები, ისე კარგად შენახული მეორადი ტანსაცმელი. მეორადი ნივთი ხშირად იმავე ხარისხის, მაგრამ გაცილებით იაფია — ამიტომ ბრენდულ ნივთს ხელმისაწვდომ ფასად იპოვი." },
      ],
      faqs: [
        { question: "რა ღირს განცხადების დამატება?", answer: "განცხადების დამატება უფასოა და გაყიდვაზე საკომისიოს არ ვიღებთ." },
        { question: "როგორ დავუკავშირდე გამყიდველს?", answer: "განცხადების გვერდზე დააჭირე „მიწერე გამყიდველს“ — საუბარი SamoSell-ის ჩატში გაიხსნება." },
        { question: "შემიძლია ქალაქის მიხედვით ძებნა?", answer: "კი, კატალოგის ფილტრში აირჩიე ქალაქი, ზომა, ბრენდი ან ფასი." },
      ],
      related: [
        { href: "/catalog/footwear", label: "ფეხსაცმელი" }, { href: "/catalog/bags", label: "ჩანთები" },
        { href: "/catalog/accessories", label: "აქსესუარები" }, { href: "/catalog/perfume", label: "სუნამოები" }, { href: "/vintage-georgia", label: "ვინტაჟი საქართველოში" },
      ],
    },
  },
  men: {
    h1: "მამაკაცის ტანსაცმელი — ახალი და მეორადი",
    title: "მამაკაცის ტანსაცმელი ონლაინ — ახალი და მეორადი",
    description: "მამაკაცის ახალი და მეორადი ტანსაცმელი ონლაინ: ქურთუკები, პიჯაკები, ჯინსები, მაისურები და ფეხსაცმელი. იყიდე პირდაპირ გამყიდველისგან მთელ საქართველოში.",
    intro: "ქურთუკები, პიჯაკები, ჯინსები და ყოველდღიური სამოსი. შეადარე შეთავაზებები და დაუკავშირდი გამყიდველს პირდაპირ.",
    guide: {
      sections: [
        { title: "მამაკაცის ტანსაცმელი ონლაინ — რას მივაქციოთ ყურადღება", text: "მამაკაცის ტანსაცმელში ზომები ბრენდების მიხედვით განსხვავდება. თუ ეჭვი გაქვს, სთხოვე გამყიდველს მხრების სიგანე, სახელოს ან შარვლის სიგრძე სანტიმეტრებში — ეს ზომაზე უფრო ზუსტია." },
        { title: "ბრენდული ნივთები ხელმისაწვდომ ფასად", text: "მეორად განცხადებებში ხშირად შეხვდები ცნობილ ბრენდებს ახალზე გაცილებით დაბალ ფასად. ბრენდის ფილტრით სწრაფად იპოვი სასურველს." },
      ],
      faqs: [
        { question: "იყიდება მხოლოდ მეორადი ტანსაცმელი?", answer: "არა — SamoSell-ზე არის როგორც ახალი, ისე მეორადი ნივთები. მდგომარეობა ყველა განცხადებაში მითითებულია." },
        { question: "როგორ გავყიდო ჩემი ტანსაცმელი?", answer: "დააჭირე „ახალი განცხადება“, ატვირთე ფოტოები და მიუთითე ფასი — განცხადება უფასოა." },
        { question: "მიწოდება როგორ ხდება?", answer: "მიწოდების ან შეხვედრის პირობებზე გამყიდველს ჩატში შეუთანხმდი." },
      ],
      related: [
        { href: "/catalog/footwear", label: "მამაკაცის ფეხსაცმელი" }, { href: "/catalog/accessories", label: "აქსესუარები" },
        { href: "/catalog/perfume", label: "სუნამოები" }, { href: "/catalog/women", label: "ქალის ტანსაცმელი" }, { href: "/safety", label: "უსაფრთხო ყიდვა" },
      ],
    },
  },
  kids: {
    h1: "ბავშვის ტანსაცმელი — ახალი და მეორადი",
    title: "ბავშვის ტანსაცმელი ონლაინ — ახალი და მეორადი",
    description: "ბავშვის ახალი და მეორადი ტანსაცმელი ყველა ასაკისა და სეზონისთვის. საბავშვო სამოსი, ფეხსაცმელი და ნაკრებები ხელმისაწვდომ ფასად — SamoSell-ზე.",
    intro: "საბავშვო სამოსი, ფეხსაცმელი და ნაკრებები ასაკისა და სეზონის მიხედვით. კარგად შენახულ ნივთებს ხელმისაწვდომ ფასად იპოვი.",
    guide: {
      sections: [
        { title: "რატომ ღირს მეორადი საბავშვო ტანსაცმელი", text: "ბავშვები სწრაფად იზრდებიან და ტანსაცმელი ხშირად რამდენიმე თვე იცმევა. ამიტომ მეორადი საბავშვო ნივთები ხშირად თითქმის ახალია, ფასი კი გაცილებით დაბალი." },
        { title: "ზომის შერჩევა", text: "შეამოწმე ასაკი ან სიმაღლე, რომელიც ეტიკეტზეა მითითებული, და სეზონი. ზამთრის ქურთუკი ერთი ზომით დიდი ხშირად უკეთესი არჩევანია." },
      ],
      faqs: [
        { question: "შემიძლია ბავშვის ტანსაცმელი უფასოდ გავაჩუქო?", answer: "კი — განცხადების დამატებისას აირჩიე „გავაჩუქებ“ და ნივთი სხვა ოჯახს გამოადგება." },
        { question: "როგორ შევამოწმო მდგომარეობა?", answer: "ყურადღება მიაქციე ფოტოებს და განცხადებაში მითითებულ მდგომარეობას; საჭიროების შემთხვევაში ითხოვე დამატებითი ფოტო." },
        { question: "განცხადება ფასიანია?", answer: "არა, განცხადების დამატება უფასოა." },
      ],
      related: [
        { href: "/catalog/footwear", label: "ფეხსაცმელი" }, { href: "/catalog/women", label: "ქალის ტანსაცმელი" },
        { href: "/catalog/men", label: "მამაკაცის ტანსაცმელი" }, { href: "/sustainable-fashion", label: "მდგრადი მოდა" },
      ],
    },
  },
  footwear: {
    h1: "ფეხსაცმელი — ახალი და მეორადი",
    title: "ფეხსაცმელი ონლაინ — კედები, ბოტასები, ჩექმები",
    description: "ახალი და მეორადი ფეხსაცმელი ონლაინ: კედები, ბოტასები, ჩექმები, ფეხსაცმელი ქალისა და მამაკაცისთვის. შეარჩიე ზომა და ფასი, იყიდე პირდაპირ გამყიდველისგან.",
    intro: "კედები, ბოტასები, ჩექმები და კლასიკური ფეხსაცმელი ერთ სივრცეში. შეარჩიე ზომა, შეამოწმე მდგომარეობა და მოძებნე შენთვის შესაფერისი წყვილი.",
    guide: {
      sections: [
        { title: "როგორ შევარჩიოთ ფეხსაცმელი ონლაინ", text: "ზომა ბრენდების მიხედვით განსხვავდება, ამიტომ სთხოვე გამყიდველს ლანჩის შიდა სიგრძე სანტიმეტრებში. მეორად ფეხსაცმელზე დააკვირდი ლანჩის ცვეთას, ქუსლს და შიდა ნაწილს." },
        { title: "კედები, ბოტასები და ჩექმები იაფად", text: "ბევრი წყვილი რამდენჯერმე ჩაცმულია ან სულაც ახალია, ფასი კი მაღაზიისაზე დაბალი. ბრენდისა და ზომის ფილტრით სწრაფად იპოვი სასურველ მოდელს." },
      ],
      faqs: [
        { question: "როგორ გავიგო ზუსტი ზომა?", answer: "სთხოვე გამყიდველს ლანჩის შიდა სიგრძე სანტიმეტრებში და შეადარე შენს ფეხსაცმელს." },
        { question: "არის ახალი ფეხსაცმელიც?", answer: "კი, მდგომარეობის ფილტრში აირჩიე „ახალი“." },
        { question: "როგორ გავყიდო ჩემი ფეხსაცმელი?", answer: "დაამატე უფასო განცხადება ფოტოებით, ზომით და ფასით." },
      ],
      related: [
        { href: "/catalog/women", label: "ქალის ტანსაცმელი" }, { href: "/catalog/men", label: "მამაკაცის ტანსაცმელი" },
        { href: "/catalog/kids", label: "ბავშვის ტანსაცმელი" }, { href: "/catalog/bags", label: "ჩანთები" },
      ],
    },
  },
  bags: {
    h1: "ჩანთები — ახალი და მეორადი",
    title: "ჩანთები ონლაინ — ხელჩანთები და ზურგჩანთები იაფად",
    description: "ახალი და მეორადი ჩანთები ონლაინ: ხელჩანთები, ზურგჩანთები, მხრის და ყოველდღიური ჩანთები ხელმისაწვდომ ფასად. შეადარე შეთავაზებები მთელი საქართველოდან.",
    intro: "ხელჩანთები, ზურგჩანთები და ყოველდღიური ჩანთები — ახალი და მეორადი, ხელმისაწვდომ ფასად.",
    guide: {
      sections: [
        { title: "რას შევამოწმოთ ჩანთის ყიდვისას", text: "დააკვირდი სახელურებს, კუთხეებს, ელვას და შიდა სარჩულს — ცვეთა პირველ რიგში ამ ადგილებზე ჩანს. ბრენდული ჩანთის შემთხვევაში ითხოვე ეტიკეტის და სერიული ნომრის ფოტო." },
        { title: "ჩანთები ყველა შემთხვევისთვის", text: "აქ იპოვი ყოველდღიურ, საქმიან, სპორტულ და სადღესასწაულო ჩანთებს. ფასისა და ბრენდის ფილტრით სწრაფად შეარჩევ შენთვის შესაფერისს." },
      ],
      faqs: [
        { question: "როგორ დავრწმუნდე ჩანთის ნამდვილობაში?", answer: "სთხოვე გამყიდველს ეტიკეტის, სერიული ნომრის და შეძენის დოკუმენტის ფოტო; ეჭვის შემთხვევაში ნუ გადაიხდი წინასწარ." },
        { question: "შეიძლება ფასზე შეთანხმება?", answer: "ფასზე გამყიდველს ჩატში მიწერე." },
        { question: "განცხადების დამატება ფასიანია?", answer: "არა, უფასოა და საკომისიოს არ ვიღებთ." },
      ],
      related: [
        { href: "/catalog/accessories", label: "აქსესუარები" }, { href: "/catalog/women", label: "ქალის ტანსაცმელი" },
        { href: "/catalog/footwear", label: "ფეხსაცმელი" }, { href: "/safety", label: "უსაფრთხო ყიდვა" },
      ],
    },
  },
  vintage: {
    h1: "ვინტაჟური ტანსაცმელი და ნივთები",
    title: "ვინტაჟური ტანსაცმელი და ნივთები საქართველოში",
    description: "აღმოაჩინე ვინტაჟური ტანსაცმელი და გამორჩეული ნივთები SamoSell-ზე. მოძებნე განსხვავებული სტილი, იყიდე ან გაყიდე შენი ვინტაჟური კოლექციის ნივთები საქართველოში.",
    intro: "აღმოაჩინე ვინტაჟური ტანსაცმელი და ნივთები საკუთარი ისტორიით. მოძებნე გამორჩეული სტილი ან გაყიდე ნივთები შენი კოლექციიდან.",
    guide: {
      sections: [
        { title: "რა არის ვინტაჟური ტანსაცმელი", text: "ვინტაჟად ჩვეულებრივ 20 წელზე ძველ, ხარისხიან ნივთებს მიიჩნევენ, რომლებიც თავისი დროის სტილს ატარებენ. ასეთი ნივთი ერთეულია და განმეორებით იშვიათად შეგხვდება." },
        { title: "როგორ შევარჩიოთ ვინტაჟი", text: "დააკვირდი ქსოვილს, ნაკერებს და ეტიკეტს. ძველ ზომებს თანამედროვე ზომები ხშირად არ ემთხვევა, ამიტომ ითხოვე ზუსტი ზომები სანტიმეტრებში." },
      ],
      faqs: [
        { question: "სად ვიყიდო ვინტაჟური ტანსაცმელი თბილისში?", answer: "SamoSell-ზე ვინტაჟურ ნივთებს მთელი საქართველოდან, მათ შორის თბილისიდან, იპოვი." },
        { question: "შემიძლია ჩემი ვინტაჟური ნივთის გაყიდვა?", answer: "კი — დაამატე უფასო განცხადება და მიუთითე ნივთის ისტორია." },
        { question: "როგორ დავუკავშირდე გამყიდველს?", answer: "განცხადების გვერდიდან მიწერე SamoSell-ის ჩატში." },
      ],
      related: [
        { href: "/vintage-georgia", label: "ვინტაჟი საქართველოში" }, { href: "/catalog/women", label: "ქალის ტანსაცმელი" },
        { href: "/catalog/men", label: "მამაკაცის ტანსაცმელი" }, { href: "/catalog/accessories", label: "აქსესუარები" },
      ],
    },
  },
  accessories: {
    h1: "აქსესუარები — ახალი და მეორადი",
    title: "აქსესუარები ონლაინ — სამკაულები, სათვალეები, ქამრები",
    description: "ახალი და მეორადი აქსესუარები ონლაინ: სამკაულები, სათვალეები, ქამრები, საათები და შარფები ხელმისაწვდომ ფასად. იყიდე ან გაყიდე SamoSell-ზე.",
    intro: "სამკაულები, ქამრები, სათვალეები და სხვა დეტალები შენი სტილისთვის. აღმოაჩინე აქსესუარები ან გაყიდე ნივთები, რომლებსაც აღარ იყენებ.",
    guide: {
      sections: [
        { title: "აქსესუარი, რომელიც სტილს ცვლის", text: "სწორად შერჩეული ქამარი, სათვალე ან სამკაული მარტივ სამოსსაც კი ახალ იერს აძლევს. აქ იპოვი როგორც ყოველდღიურ, ისე სადღესასწაულო აქსესუარებს." },
        { title: "რას შევამოწმოთ ყიდვისას", text: "სამკაულზე ითხოვე მასალის ინფორმაცია, სათვალეზე — ლინზების მდგომარეობა, საათზე — მუშაობს თუ არა. ეს ყველაფერი ჩატში მარტივად შეგიძლია ჰკითხო." },
      ],
      faqs: [
        { question: "რა აქსესუარები იყიდება?", answer: "სამკაულები, სათვალეები, ქამრები, საათები, შარფები, ქუდები და სხვა." },
        { question: "როგორ გავყიდო აქსესუარი?", answer: "დაამატე უფასო განცხადება ფოტოებით და აღწერით." },
        { question: "გაყიდვაზე საკომისიო არის?", answer: "არა, SamoSell გაყიდვაზე საკომისიოს არ იღებს." },
      ],
      related: [
        { href: "/catalog/bags", label: "ჩანთები" }, { href: "/catalog/perfume", label: "სუნამოები" },
        { href: "/catalog/women", label: "ქალის ტანსაცმელი" }, { href: "/catalog/men", label: "მამაკაცის ტანსაცმელი" },
      ],
    },
  },
  perfume: {
    h1: "სუნამოები და პარფიუმერია",
    title: "სუნამოები და პარფიუმერია ონლაინ — ქალის და მამაკაცის",
    description: "სუნამოები და პარფიუმერია ონლაინ: ქალის და მამაკაცის სუნამოები ბრენდის, მოცულობისა და ფასის მიხედვით. შეადარე შეთავაზებები და დაუკავშირდი გამყიდველს.",
    intro: "მოძებნე სუნამო სასურველი ბრენდისა და მოცულობის მიხედვით. შეამოწმე მდგომარეობა და დეტალები, შემდეგ დაუკავშირდი გამყიდველს.",
    guide: {
      sections: [
        { title: "როგორ შევარჩიოთ სუნამო ონლაინ", text: "მიაქციე ყურადღება ბრენდს, მოცულობას (მლ) და კონცენტრაციას — Eau de Parfum ჩვეულებრივ უფრო მდგრადია, ვიდრე Eau de Toilette. ნახმარი ფლაკონის შემთხვევაში ჰკითხე გამყიდველს, რამდენი დარჩა." },
        { title: "ორიგინალობა და შეფუთვა", text: "სთხოვე გამყიდველს ყუთის, ბარკოდისა და პარტიის ნომრის ფოტო. ეჭვის შემთხვევაში ნივთი ადგილზე, პირადად შეხვედრისას შეამოწმე." },
      ],
      faqs: [
        { question: "შეიძლება ნახმარი სუნამოს ყიდვა?", answer: "კი — განცხადებაში მითითებულია მდგომარეობა და დარჩენილი რაოდენობა; დააზუსტე გამყიდველთან." },
        { question: "როგორ მოვძებნო კონკრეტული ბრენდი?", answer: "გამოიყენე ბრენდის ფილტრი ან ძებნა გვერდის თავში." },
        { question: "როგორ გავყიდო სუნამო?", answer: "დაამატე უფასო განცხადება ფლაკონის ფოტოებით, მოცულობით და ფასით." },
      ],
      related: [
        { href: "/catalog/accessories", label: "აქსესუარები" }, { href: "/catalog/bags", label: "ჩანთები" },
        { href: "/catalog/women", label: "ქალის ტანსაცმელი" }, { href: "/catalog/men", label: "მამაკაცის ტანსაცმელი" },
      ],
    },
  },
} as const satisfies Record<string, CategorySeoEntry>

export function getCategorySeo(category?: string) {
  return INDEXABLE_CATALOG_CATEGORIES.some((item) => item.value === category)
    ? CATEGORY_SEO[category as keyof typeof CATEGORY_SEO]
    : null
}

export function getSiteUrl() {
  return SITE_URL
}

export function absoluteUrl(path = "/") {
  if (!path.startsWith("/")) path = `/${path}`
  return `${getSiteUrl()}${path}`
}

export function stripHtml(value?: string | null) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

const SHORT_META_DESCRIPTION_THRESHOLD = 90
const SHORT_META_DESCRIPTION_SUFFIX =
  "დამატებითი დეტალები, ფოტოები და სხვა აქტიური შეთავაზებები ნახე SamoSell-ზე."

export function truncateDescription(value?: string | null, maxLength = 160) {
  const safe = stripHtml(value)
  if (!safe) return ""

  const shouldEnrichForMeta =
    maxLength <= 180 && safe.length < SHORT_META_DESCRIPTION_THRESHOLD
  const punctuation = /[.!?…]$/.test(safe) ? "" : "."
  const enriched = shouldEnrichForMeta
    ? `${safe}${punctuation} ${SHORT_META_DESCRIPTION_SUFFIX}`
    : safe

  if (enriched.length <= maxLength) return enriched
  return `${enriched.slice(0, maxLength - 1).trim()}…`
}

export function buildCatalogTitle(page = 1, categoryLabel = "") {
  const base = categoryLabel
    ? `${categoryLabel} — კატალოგი`
    : "მეორადი ტანსაცმლის კატალოგი საქართველოში"
  return page > 1 ? `${base} — გვერდი ${page}` : base
}

export function buildCatalogDescription(filters: string[] = []) {
  // SamoSell is a Georgian-language marketplace; an English description here
  // competed with every Georgian category page in the SERP snippet.
  const base = SITE_DESCRIPTION_KA
  if (filters.length === 0) return base
  return `${base} აქტიური ფილტრები: ${filters.join(", ")}.`
}

export function buildCatalogCanonicalPath({
  page,
  category,
  hasOtherFilters,
  hasSortParameter,
  hasTransientState,
}: {
  page: number
  category?: string
  hasOtherFilters: boolean
  hasSortParameter: boolean
  hasTransientState: boolean
}) {
  const canonicalCategory = INDEXABLE_CATALOG_CATEGORIES.find(
    (item) => item.value === category,
  )
  const indexable =
    (!category || Boolean(canonicalCategory)) &&
    !hasOtherFilters &&
    !hasSortParameter &&
    !hasTransientState
  const canonicalRoot = canonicalCategory
    ? catalogCategoryHref(canonicalCategory.value)
    : "/catalog"

  return {
    canonicalPath:
      indexable && page > 1
        ? `${canonicalRoot}?page=${page}`
        : canonicalRoot,
    indexable,
    categoryLabel: canonicalCategory?.label ?? "",
  }
}

export function buildCatalogStructuredData({
  canonicalPath,
  title,
  description,
  categoryLabel,
  page = 1,
  listings,
}: {
  canonicalPath: string
  title: string
  description: string
  categoryLabel?: string
  page?: number
  listings: CatalogListing[]
}) {
  const pageUrl = absoluteUrl(canonicalPath)
  const itemListId = `${pageUrl}#item-list`
  const collectionId = `${pageUrl}#collection`
  const breadcrumbItems: Array<Record<string, unknown>> = [
    {
      "@type": "ListItem",
      position: 1,
      name: "მთავარი",
      item: absoluteUrl("/"),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "კატალოგი",
      item: absoluteUrl("/catalog"),
    },
  ]

  if (categoryLabel) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 3,
      name: categoryLabel,
      item: absoluteUrl(
        catalogCategoryHref(
          INDEXABLE_CATALOG_CATEGORIES.find((item) => item.label === categoryLabel)?.value,
        ),
      ),
    })
  }

  if (page > 1) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbItems.length + 1,
      name: `გვერდი ${page}`,
      item: pageUrl,
    })
  }

  const listItems = listings.map((listing, index) => ({
    "@type": "ListItem",
    position: (page - 1) * 24 + index + 1,
    url: absoluteUrl(`/listing/${listing.slug}`),
    name: listing.title,
    ...(listing.cover_image_url
      ? {
          image: listing.cover_image_url.startsWith("/")
            ? absoluteUrl(listing.cover_image_url)
            : listing.cover_image_url,
        }
      : {}),
  }))

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": collectionId,
        url: pageUrl,
        name: title,
        description,
        inLanguage: "ka-GE",
        isPartOf: { "@id": `${getSiteUrl()}/#website` },
        mainEntity: { "@id": itemListId },
      },
      {
        "@type": "ItemList",
        "@id": itemListId,
        name: categoryLabel ? `${categoryLabel} — SamoSell` : "SamoSell კატალოგი",
        numberOfItems: listItems.length,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        itemListElement: listItems,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems,
      },
    ],
  }
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

export function buildHomeStructuredData() {
  const siteUrl = getSiteUrl()

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: SITE_NAME,
        url: siteUrl,
        logo: absoluteUrl("/logo-master.png"),
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: SITE_NAME,
        url: siteUrl,
        inLanguage: "ka-GE",
        publisher: { "@id": `${siteUrl}/#organization` },
        // Declares the internal search results page to search engines so a
        // sitelinks search box can be offered for brand queries.
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteUrl}/catalog?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  }
}

function schemaCondition(condition: string) {
  return condition === "new"
    ? "https://schema.org/NewCondition"
    : "https://schema.org/UsedCondition"
}

export function buildListingStructuredData(
  listing: CatalogListing,
  imageUrls: string[] = [],
) {
  const listingUrl = absoluteUrl(`/listing/${listing.slug}`)
  const images = Array.from(
    new Set(
      [listing.cover_image_url, ...imageUrls]
        .filter((value): value is string => Boolean(value))
        .map((value) => (value.startsWith("/") ? absoluteUrl(value) : value)),
    ),
  )
  const condition = schemaCondition(listing.condition)
  const product: Record<string, unknown> = {
    "@type": "Product",
    "@id": `${listingUrl}#product`,
    name: listing.title,
    description:
      truncateDescription(listing.description, 500) ||
      [listing.category_name, listing.brand_name].filter(Boolean).join(" · "),
    sku: listing.public_id || listing.id,
    url: listingUrl,
    // Avoid emitting broad marketplace audience labels as Product categories.
    // Google may reject values such as "ქალებისთვის" in merchant listing markup.
    itemCondition: condition,
    offers: {
      "@type": "Offer",
      url: listingUrl,
      price: Number(listing.price).toFixed(2),
      priceCurrency: listing.currency || "GEL",
      availability: "https://schema.org/InStock",
      itemCondition: condition,
    },
  }

  if (images.length > 0) product.image = images
  if (listing.brand_name) {
    product.brand = { "@type": "Brand", name: listing.brand_name }
  }
  if (listing.color) product.color = listing.color
  if (listing.material) product.material = listing.material
  if (listing.size_label) product.size = listing.size_label

  return {
    "@context": "https://schema.org",
    "@graph": [
      product,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "მთავარი",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "კატალოგი",
            item: absoluteUrl("/catalog"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: listing.title,
            item: listingUrl,
          },
        ],
      },
    ],
  }
}
