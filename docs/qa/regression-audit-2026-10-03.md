# SamoSell — Regression QA და performance audit

თარიღი: 2026-10-03, თბილისი. შემოწმებული application commit: `480405db9d8805343ee82310f82afe656d7cc094`, branch `preview/trust-layer-20261003`.
Preview: https://samosell-lunching2-4feho2qqb-giorgibulbula-6265s-projects.vercel.app

**შედეგი: release gate ჯერ ვერ ჩაითვლება გავლილად.** Public preview მუშაობს, მაგრამ suite წითელია, საწყის ჩატვირთვაზე აღმოჩნდა CLS ხარვეზი და ავტორიზებული mutation/payment flow-ები live გარემოში არ არის სრულად დადასტურებული.

## ტესტების შედეგი

- სრული Vitest: **133 ფაილი; 127 წარმატებული, 6 წარუმატებელი. 667 ტესტი; 657 წარმატებული, 10 წარუმატებელი.**
- იგივე ექვს ფაილში 10 ჩავარდნა წინა უცვლელ baseline-ზეც დაფიქსირდა. ამ გაშვებაში ახალი failing test არ დამატებულა. ეს არ გამორიცხავს დაუფარავ რეგრესიებს.
- TypeScript: წარმატებული. Lint: 0 errors, 9 warnings.
- იგივე application tree-ის ბოლო local webpack build წარმატებული; Vercel deployment READY.
- Gift-ის დამატებითი ორი targeted runtime ტესტი წარმატებულია: ცარიელი gift ფასი დაშვებულია, ძველი sale ფასი gift-ისას ნულდება; ცარიელი sale ფასი უარყოფილია.
- Production-ზე არ განხორციელებულა deploy, schema mutation, რეალური payment, მომხმარებლის რეგისტრაცია/პაროლის ცვლილება ან listing mutation.

| ჩავარდნილი ფაილი | რაოდენობა | დაფიქსირებული მიზეზი |
|---|---:|---|
| CatalogStates | 1 | Georgian category chip-ის მოსალოდნელი accessible link ვერ მოიძებნა |
| CreateListingForm | 4 | fixture category `1` dropdown-ში ვერ მოიძებნა; image DOM assertion შეუსაბამოა |
| CreateListingWizard | 1 | fixture category `1` dropdown-ში ვერ მოიძებნა |
| ListingDraftRestore | 1 | category restore-ის მოსალოდნელი მნიშვნელობა არ დადასტურდა |
| ListingDraftStorage | 1 | შენახული draft ვერ აღდგა; fixture-ს აკლია validator-ის მიერ მოთხოვნილი `customBrand` |
| MyListingsUi | 2 | actions mock-ს აკლია `deleteListingAction` |

ეს არის ტესტის failure მიზეზები და არა ექვსი დადასტურებული live product bug. Fixture/expectation უნდა განახლდეს არსებული taxonomy/API-ის შესაბამისად; restore flow უნდა დაიტესტოს მოქმედი draft-ითაც. ტესტების წაშლა ან expectations-ის დასუსტება არ არის გამოსავალი.

## Desktop / mobile preview

ორი viewport: 390×844 და 1440×900. 17 route თითოეულზე, დამატებით ერთი login email validity შემოწმება: **35 checks, 0 დაფიქსირებული page JS error, 0 ჰორიზონტალური page overflow, 0 დაფიქსირებული 5xx**.

შესამოწმებლად მხოლოდ GET დაშვებული იყო preview origin-ზე და Supabase-ის listing storage-ზე; analytics, beacon, server-action და სხვა mutation requests იბლოკებოდა. ამიტომ ეს არის read-only smoke და არა ყოველი flow-ის end-to-end დასრულება. Chromium emulation რეალური iOS Safari/Android მოწყობილობის ტესტს არ ცვლის.

| Flow | Live preview | სხვა მტკიცებულება / დარჩენილი ნაბიჯი |
|---|---|---|
| Login | ეკრანი ორივე ზომაზე; malformed email invalid | Auth redirect/security tests გადის; რეალური successful login/session refresh არ შესრულებულა |
| Register | ეკრანი ორივე ზომაზე | რეალური account creation და confirmation email არ შესრულებულა |
| Password reset | ფორმა და invalid/expired session redirect დადასტურდა | Recovery source/redirect tests გადის; რეალური recovery email და password update დარჩენილია |
| Add listing | unauthenticated მოთხოვნა login-ზე გადადის | Action validation/upload tests გადის; wizard UI tests-ში ზემოთ აღწერილი failures რჩება; რეალური upload/publish დარჩენილია |
| Edit / delete | listing management-ის auth guard დადასტურდა | Ownership/delete action/security tests გადის; disposable listing-ის რეალური edit/delete დარჩენილია |
| Gift | `sale_type=gift` გვერდი იტვირთება | ორი ახალი runtime validation test გადის; deployed DB constraints უშვებს gift-ს მხოლოდ price=0-ით; რეალური publish დარჩენილია |
| VIP | filter ეკრანი და boost dashboard guard მუშაობს | Boost term/signature/lifecycle/database tests გადის; რეალური activation/expiry დარჩენილია |
| Filters / search | catalog, Nike query, gift, VIP, price range/sort URL-ები იტვირთება | ეს არ ამოწმებს ყველა lookup კომბინაციას და dropdown interaction-ს; CatalogStates failure დარჩენილია |
| Chat | dashboard guard მუშაობს | არსებული chat action/component/security tests გადის; ორ რეალურ მონაწილეს შორის გაგზავნა არ შესრულებულა |
| Notifications | dashboard guard მუშაობს | ახალი reminder და unread/read-state tests გადის; login-ით live dismissal/event მიღება დარჩენილია |
| Payments | unauthenticated boost UI მიუწვდომელია | Flitt sandbox/signature/callback/idempotency/database tests გადის; provider sandbox browser checkout არ შესრულებულა; რეალური თანხა არ ჩამოჭრილა |
| Seller/listing trust | რეალური გვერდები იტვირთება | წინა 320–430px, 768 და 1440px trust stress QA წარმატებულია; canonical counts/ratings tests გადის |

ყველა auth-required write flow-ის უსაფრთხო დასრულებისთვის საჭიროა isolated test project ან dedicated disposable accounts/listings და provider sandbox. Preview არსებული production Supabase project-ს უკავშირდება; preview URL თავისთავად მონაცემების იზოლაციას არ ნიშნავს.

## Field performance — ბოლო 7 დღის მონაცემები

წყარო: არსებული `public.web_vitals_events`, read-only aggregate SQL. ეს არ არის CrUX-ის 28-დღიანი ანგარიში და ვერ მიეწერება მხოლოდ ბოლო commit-ს: ცხრილში deployment/environment ან metric ID არ ინახება.

მოწყობილობის არსებული label არ არის სანდო: 1905×911 viewport-ის 734 ჩანაწერი `tablet`-ად ინახება, 1265×665 — `phone`-ად. ქვემოთ დაჯგუფებულია **viewport width-ით**, და არა device label-ით: narrow ≤767px, wide ≥1025px. Landscape phone/tablet შეიძლება wide ჯგუფში მოხვდეს.

| Viewport / route | LCP p75 (n) | INP p75 (n) | CLS p75 (n) | TTFB p75 (n) |
|---|---:|---:|---:|---:|
| Narrow / home | 3.030 s (30) | 56 ms (9) | 0.000 (1) | 684 ms (66) |
| Narrow / catalog | 2.032 s (5) | 60 ms (11) | 0.000 (1) | 218 ms (6) |
| Narrow / search | 2.398 s (3) | არ არის | არ არის | 234 ms (2) |
| Narrow / listing | 28.003 s (12) | 96 ms (4) | არ არის | 283 ms (10) |
| Wide / home | 4.004 s (125) | 32 ms (69) | 0.078 (140) | 1496 ms (171) |
| Wide / catalog | 6.028 s (41) | 64 ms (36) | 0.023 (48) | 852 ms (47) |
| Wide / search | 3.999 s (2) | არ არის | 0.000 (2) | 544 ms (2) |
| Wide / listing | 3.873 s (6) | 28 ms (8) | 0.256 (14) | 150 ms (8) |

დაბალი n-ის, label შეცდომებისა და ქვემოთ ჩამოთვლილი instrumentation პრობლემების გამო ეს არის დიაგნოსტიკური სიგნალი და არა სანდო release pass/fail ან before/after შედარება. Missing metric არ ნიშნავს ნულს.

საორიენტაციო good საზღვრები: LCP≤2.5s, INP≤200ms, CLS≤0.1; ჩვეულებრივი TTFB სამიზნე≤800ms. TTFB თვითონ Core Web Vital არ არის. ოფიციალური წყაროები: https://web.dev/articles/vitals და https://web.dev/articles/ttfb.

## დადასტურებული / სავარაუდო პრობლემები

### P1 — საწყისი ჩატვირთვის footer shift

Read-only preview trace, 390×844, ცალკე load-ის პირველ 5 წამში:

| Route | ბოლო observed LCP candidate | Navigation TTFB | Layout shift |
|---|---:|---:|---|
| Home | 1.360 s, hero background | 525 ms | footer-ის shift entry=1.0; დამატებით მცირე font shift |
| Catalog | 1.072 s, ad background | 521 ms | footer-ის shift entry=1.0; დამატებით მცირე font shift |
| Listing Mango | 1.400 s, მთავარი product image | 565 ms | trace-ში shift არ დაფიქსირებულა |

ამ trace-ში footer-ის საწყისი rectangle იყო ეკრანის მთელი 390×844, შემდეგ viewport-იდან გაქრა. Home/catalog-ის პირველი დამოუკიდებელი smoke trace-ც დაახლოებით 1.0 CLS-ს აფიქსირებდა. საჭიროა loading/streaming boundary-ში content-ის ადგილის დაცვა და footer-ის ადრეული ჩახატვის გაკონტროლება. მხოლოდ საბოლოო screenshot ამას ვერ აჩვენებს.

ეს არის proxy-ით გაზომილი, დაუთროთლავი single-run synthetic diagnostics. არა CrUX, არა რეალური phone benchmark და არა interaction-ის დასრულებული INP. LCP candidate შეიძლება მოგვიანებით შეიცვალოს; offscreen lazy images-ის არჩატვირთვა თავისთავად შეცდომა არ არის.

### P1 — performance instrumentation სანდოობა

- `components/shared/FieldWebVitals.tsx` device კლასს ადგენს viewport-ის უმოკლესი მხარით, რაც ჩვეულებრივ desktop window-საც tablet/phone-ად ნიშნავს. width ჯგუფები ან platform context ცალკე უნდა ჩაიწეროს.
- Metric callback კითხულობს მიმდინარე `window.location.pathname/search`-ს. Document-level LCP/CLS შეიძლება დასრულდეს SPA route change-ის შემდეგ და სხვა გვერდის ჯგუფს მიეწეროს. საჭიროა document navigation context-ის დაფიქსირება; soft navigation ცალკე გაზომვა.
- `web_vitals_events` არ ინახავს metric ID/session/pageview/environment/deployment-ს და endpoint-ს idempotent deduplication არ აქვს. Listing LCP-ში 28.003s მნიშვნელობა ოთხჯერ მეორდება — შესაძლო duplicate სიგნალი; duplicate საბოლოოდ ვერ დასტურდება არსებულ ველებზე.
- Narrow listing CLS-ს ახალი width aggregation-ში არც ერთი sample არ აქვს. მონაცემების არყოფნა არ არის CLS pass.

### P1 — suite და end-to-end release gate

ზემოთ ჩამოთვლილი 10 ჩავარდნა უნდა გამოსწორდეს taxonomy/API-compatible fixtures-ით და მოქმედი drafts-ით. Live ავტორიზებული flow-ები disposable მონაცემებით უნდა დასრულდეს, სანამ login/register/publish/delete/payment მთლიანად verified-ად გამოცხადდება.

### P2 — LCP / TTFB გამოძიება

Wide home/catalog LCP და home TTFB საყურადღებოა. Listing-ის მაღალი field LCP ჯერ route attribution/deduplication-ის გასწორების შემდეგ გადაამოწმეთ. მთავარ listing image-ს უკვე eager/high priority აქვს და ამ კონკრეტულ preview trace-ში იტვირთებოდა; ზოგადი lazy-loading დიაგნოზი დაუდასტურებელია.

შემდგომი waterfall პროფილი: SSR/data wait → CSS/font discovery → hero/product image discovery/bytes → render delay. თითო გვერდზე cold/warm და mobile network/CPU პირობები ცალკე, median და variability-ით. გამართული telemetry-ის შემდეგ აგროვდება ახალი traffic მონაცემები და ითვლება segmented p75.

## შემდეგი სამუშაოების რიგი

1. Footer-ის საწყისი shift-ის გასწორება preview-ზე და shift-source trace-ის გამეორება.
2. Metric navigation/device context + ID/deduplication + environment/deployment ატრიბუცია; backward-compatible DB migration, production-ზე მხოლოდ ცალკე დამტკიცებით.
3. ათი regression test failure-ის გამოსწორება; gift ტესტები შენარჩუნდეს suite-ში.
4. Isolated/disposable authenticated QA: register→confirm→login→reset; upload→publish→edit→gift→delete; two-user chat; notification dismissal; Flitt sandbox→callback→VIP→replay.
5. გამართული field მონაცემებით LCP/CLS/INP/TTFB p75-ის ხელახლა შეფასება.
