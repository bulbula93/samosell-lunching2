# SamoSell preview — performance stabilization და regression QA

Branch: `preview/trust-layer-20261003`. Production deploy, main merge, migration და environment ცვლილება არ შესრულებულა.

Wizard fix application commit: `4519f9a9efa30cf24e6dd376901382e94e8e3366`. Vercel READY: https://samosell-lunching2-m2x96y4eg-giorgibulbula-6265s-projects.vercel.app .

ეს ანგარიში ავსებს `regression-audit-2026-10-03.md`-ს; ძველი baseline არ შეცვლილა. Release gate **NOT READY** რჩება, სანამ ქვემოთ აღწერილი authenticated flows და test-data isolation არ დაიხურება.

## Footer CLS — დადასტურებული მიზეზი და ცვლილება

Home/Catalog-ის async streaming-ისას main კონტენტი ჯერ არ იყო დახატული. `DelayedRouteLoader` თავდაპირველად არაფერს აბრუნებდა, შემდეგ fixed overlay-ს აჩვენებდა; არცერთი მდგომარეობა main-ის სივრცეს არ იკავებდა. Footer პირველად თითქმის მთელ viewport-ზე ჩანდა და კონტენტის მიღებისას ეკრანიდან გადადიოდა. LayoutShift source-ის footer rectangle იყო 390×844 → 0; shift entry = 1.0.

Root layout-ის main-ს დაემატა `min-h-screen`, ამიტომ საწყისი streaming shell უკვე რეზერვირებს მინიმუმ ერთ viewport-ს. Footer-ის counter-ის პარალელური branch ცვლილების ფიქსირებული 88×31 სივრცე შენარჩუნებულია. SVG ლოგოებს წინასწარ განსაზღვრული ზომები აქვთ; social icons არ აღმოჩნდა 1.0 shift-ის წყარო. მცირე font-related shifts ზოგ ზომაზე ისევ ჩანს, მაგრამ footer-ის სრული shift აღარ განმეორებულა.

## LCP waterfall — გაზომვა ცვლილებამდე

390×844 Chromium, preview GET-only diagnostic; დაუთროთლავი proxy connection. ქვემოთ single-run Resource Timing + LCP element measurements-ია და არა field p75.

| Page | LCP element | TTFB | Resource discovery delay | Resource load duration | Render delay | LCP |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Catalog, before | სარეკლამო background image | 577 ms | 263 ms | 227 ms | 225 ms | 1.292 s |
| Listing Mango, before | მთავარი product image | 633 ms | 480 ms | 272 ms | 367 ms | 1.752 s |
| Catalog, after | იგივე ad, responsive Next/Image | 561 ms | 292 ms | 186 ms | 45 ms | 1.084 s |
| Listing Mango, after | მთავარი product image | 599 ms | 1305 ms | 154 ms | 22 ms | 2.080 s |

Resource discovery delay = resource start − document responseStart; resource load duration შეიცავს resource request-ის ლოდინსა და body download-ს. Listing after-ში image responseStart→responseEnd ≈54 ms იყო; Catalog after-ში ≈30 ms. დამოუკიდებელ runs-ს განსხვავებული SSR/network/cache დრო აქვს. Listing after discovery delay უფრო მაღალია, ვიდრე before, ამიტომ ამ runs-ით listing-ის LCP გაუმჯობესებას არ ვაცხადებთ.

Catalog-ის გაზომილი LCP იყო `/brand/samosell-ad-bg.jpg`, 633,258 encoded bytes; არა პირველი product card. `AdPlaceholder`-ში იგივე დიზაინი გადაიყვანეს responsive Next/Image-ზე, reserved container-ის შენარჩუნებით. Top placements eager/high priority-ით იტვირთება; დანარჩენი lazy/auto-ა. გაზომილი 640px ვერსია 11,038 bytes გახდა (~98% შემცირება). Query correctness/pagination/filter logic არ გამარტივებულა score-ის მისაღებად.

Listing-ის მთავარ image-ს მანამდეც eager/high priority და responsive sizing ჰქონდა. ამ კონკრეტულ viewport-ზე ოპტიმიზებული image 57,860 bytes იყო; ერთი და იგივე resource-ის duplicate request ამ trace-ში არ აღმოჩნდა. Image lazy-loading-ის თვითნებური ცვლილება არ შესრულებულა.

**ისტორიული Listing 28.003 s ჯერ ზუსტად დაუდგენელია.** არსებული field table არ ინახავს LCP element/resource, metric ID, document/pageview ID ან environment/deployment-ს. ერთნაირი მნიშვნელობის გამეორება და ძველი route attribution შესაძლო instrumentation მიზეზებია, მაგრამ ისინი ისტორიულ შემთხვევას არ ამტკიცებს. შესამოწმებლად საჭიროა იმ შემთხვევის URL + viewport/network context და Performance trace, ან ახალ preview-ზე გამეორებადი შემთხვევა. Schema ცვლილება ამ შეზღუდვის მოსახსნელად არ განხორციელებულა.

## Before → After და responsive QA

იგივე 390×844 initial-load diagnostic:

| Metric | Before | After |
| --- | ---: | ---: |
| Home CLS | ≈1.00048 | 0.00048 |
| Catalog CLS | ≈1.00007 | 0.00007 |
| Catalog LCP image bytes | 633,258 | 11,038 |
| Catalog measured LCP | 1.292 s | 1.084 s |

ახალი viewport sweep: 360, 390, 768, 1024 და 1440px, 17 routes თითოეულზე + login malformed-email validity = **86 checks, 0 detected horizontal overflow, 0 captured page JS errors, 0 detected 5xx**. Auth-required routes ამ sweep-ში მხოლოდ login guard-ითაა შემოწმებული; authenticated dashboard-ის ხუთივე ზომაზე გავლას არ ვაცხადებთ.

Sweep-ის ადრეულ trace window-ში Home CLS მაქსიმუმ 0.0371 იყო; Catalog მაქსიმუმ 0.00369. 1440px Catalog-ზე ადრეული LCP sample არ იყო: missing sample არ უდრის ნულს. ცალკე 5-წამიანი 390px diagnostic ზემოთაა. Chromium emulation რეალურ Safari/iOS/Android მოწყობილობას არ ცვლის.

ძველი field Catalog p75 ≈6.03 s არ არის ახალი preview-ის after measurement. Production traffic უცვლელი app-ზეა; field improvement და რეალური INP release pass ჯერ არ დასტურდება.

## Telemetry

არსებული reporter შენარჩუნებულია. საერთო helper viewport width-ით კლასიფიცირებს: ≤767 `phone`, 768–1024 `tablet`, ≥1025 `desktop`; API-ის არსებული სახელები არ შეცვლილა. უმოკლესი მხარის მცდარი წესი აღარ გამოიყენება. Document metric-ის route მოდის original navigation entry-დან და SPA navigation-ის შემდეგ სხვაგან არ მიეწერება. Callback სტაბილურია; bounded in-memory deduplication იმავე name/ID/value-ს განმეორებას აფერხებს. Consent/automation exclusion მოქმედებს; reporter DOM-ს არ ამატებს.

Targeted helper tests მოიცავს 360/390/767/768/1024/1440/1905px-სა და original-document route attribution-ს. Backend schema უცვლელია; historical events-ის deployment attribution და server-side metric-ID deduplication unresolved რჩება.

## თავდაპირველი 10 failure-ის კლასიფიკაცია

| Failure group | Count | Classification | Resolution |
| --- | ---: | --- | --- |
| CatalogStates category chip | 1 | Real regression | Category chip რეალური Georgian name-ით ჩანს; removal შლის incompatible item_type/size-ს და ინარჩუნებს სხვა query-ს |
| CreateListingForm | 4 | Outdated fixtures/expectations | მოქმედი category slug/name; image expectation რეალურ accessible output-ს ემთხვევა |
| CreateListingWizard | 1 | Outdated fixture | category fixture taxonomy-ს შეესაბამება |
| ListingDraftRestore | 1 | Outdated fixture | restore გამოიყენებს რეალურ category option-ს |
| ListingDraftStorage | 1 | Outdated fixture | draft-ს დაემატა არსებული validator-ის required `customBrand` |
| MyListingsUi | 2 | Outdated mock/expectation | mock შეიცავს არსებულ delete action-ს; delete control-ის განზრახ მხარდაჭერა დადასტურებულია |

არცერთი test არ წაშლილა. თავდაპირველი failures არ აღმოჩნდა flaky ან environment-only. TypeScript წარმატებულია; lint 0 errors / 0 warnings; სრული suite **135 files, 678 tests passed / 0 failed**; production webpack build წარმატებულია.

## Authenticated browser QA — ახალი კრიტიკული აღმოჩენა

მომხმარებელმა Google/passkey sign-in თავად დაასრულა. Callback დაბრუნდა preview origin-ზე; authenticated dashboard/profile menu წარმატებით გაიხსნა.

Wizard-ის რეალურ interaction-ში ფოტოს არქონა და ცარიელი sale price სწორად უარყოფილი იყო. ფოტოს local selection და details შევსება მუშაობდა. მაგრამ step 3-ზე `გაგრძელება →`-ზე click-ისას React იმავე button DOM node-ს final `type=submit` control-ად ცვლიდა. Native default activation უკვე შეცვლილ type-ს ხედავდა; Preview-ზე გადასვლა დაუდასტურებლად იწვევდა upload/save-ს.

ამის შედეგად შეიქმნა ერთი აშკარად მონიშნული QA fixture: `QA 2026-10-03 — სატესტო ნივთი, არ შეიძინოთ`, ID `ebac9bad-7ce7-4800-a86e-84cd979a57d7`. Read-only SQL-ით დადასტურებულია `sale_type=gift`, `price=0.00`, `status=active`. ეს იყო მოულოდნელი mutation, რადგან preview იმავე production Supabase project-ს იყენებს. სხვა რეალური განცხადების mutation ან deletion არ შესრულებულა. ჩანაწერისა და მისივე ფოტოს cleanup მოითხოვს ცალკე დადასტურებას: UI hard-delete შეუქცევადია.

შესწორება: navigation click-ზე preventDefault და სხვადასხვა key next/save buttons-ისთვის. ახალი sale/gift native-activation safety assertions ძველ კოდზე ორივე ვარდებოდა; შესწორების შემდეგ გადის. ტესტები ასევე ადასტურებს, რომ upload/save Preview-მდე არ იძახება და explicit publish იწყებს upload preparation-ს. UI/სერვერის validation წესები არ შეცვლილა.

Authenticated browser-ზე დადასტურდა dashboard, wizard validation, local photo selection, gift detail rendering, edit-form restoration, notifications/favorites empty states და 4 საუბრის chat list. 1363px browser-ზე chat list-ის page width 1348px იყო, overflow არ დაფიქსირდა. რეალური search interaction Mango-ს ერთ შედეგს აბრუნებდა; Mango + gift filter 0 შედეგს და სწორ empty state-ს; gift chip-ის მოხსნა search-ს ინარჩუნებდა და Mango შედეგს აბრუნებდა. სხვის რეალურ chat-ში QA შეტყობინებები არ გაიგზავნა. Edit submission, delete, two-user receipt, register confirmation/reset და full payment callback lifecycle დასრულებულად არ ითვლება.

შესწორებული READY deployment-ზე Google sign-in ხელახლა წარმატებით დასრულდა. რეალური browser clicks-ით sale (120 ₾) და gift სცენარები step 4 Preview-ზე დარჩა; save progress არ დაწყებულა, publish button enabled იყო და ცალკე დაჭერას ელოდებოდა. საჯარო title `QA VALIDATION — მხოლოდ Preview, არ გამოაქვეყნოთ`-ით ფორმა შემოწმდა; გამოქვეყნება არ დაჭერილა. Read-only SQL-ით ამ title-ის persisted row count = 0 დადასტურდა. Logout დაბრუნდა login-ზე; შემდეგ `/dashboard/listings/new` კვლავ login-ზე გადავიდა სწორი `next` query-ით.

Preview admin Flitt readiness: `mode=test`, feature flag=true, production deployment=false, merchant/secret/API configured, sandbox ready. Live provider ოპერაცია არ შესრულებულა. Sandbox credentials-ის არსებობა მხოლოდ configuration readiness-ს ადასტურებს; checkout/callback/VIP activation-ს არ ვაცხადებთ გავლილად.

## დარჩენილი release blockers

1. QA fixture cleanup-ის დადასტურება და writable QA scope: isolated preview Supabase project ან კონკრეტული disposable test accounts/fixtures-ის ცვლილებების ცალკე დაშვება საერთო DB-ში.
2. Explicit publish/edit/gift/delete მხოლოდ დაშვებული test records-ით; deployed wizard navigation fix უკვე რეალურ browser-ზე დადასტურებულია.
3. მეორე მონაწილესთან isolated chat/notification round-trip და persistence/unread verification.
4. Register → confirmation, email/password login და password-reset completion. Google login/logout და შემდგომი auth guard უკვე დადასტურებულია. Secret entry/change მხოლოდ მომხმარებლის secure/browser handoff-ით.
5. Flitt sandbox checkout → signed verification/callback → VIP activation/replay. Live payment აკრძალული რჩება.
6. Authenticated mobile/tablet regression და field LCP/INP/CLS/TTFB-ის ახალი, სანდო attribution-ით შეფასება.

**Production deploy: NOT READY.**
