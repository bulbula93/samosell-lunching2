# SamoSell Clarity UX audit — 2026-11-09

**Status: Partial behavioral audit; NOT READY for a Production release.**

## მოკლე შეფასება

Clarity-ზე ავტორიზებული წვდომა მუშაობდა. საწყისი მონაცემები გადამოწმდა, შვიდი ჩანაწერის მოვლენები და შერჩეული ვიდეომონაკვეთები შემოწმდა, ექვსივე მოთხოვნილი გვერდის მობილური და დესკტოპის heatmap/scrollmap ხედები გაიხსნა. ჩანაწერები მთლიანად, თავიდან ბოლომდე არ გვინახავს.

მთავარი შეზღუდვაა შიდა და რეალური მომხმარებლების შერევა: მფლობელმა დაადასტურა ხშირი მუშაობა Chrome-ით და iPhone-ით. ადმინისტრატორის დადასტურებული ბრაუზერი დროებითი ფილტრით გამოირიცხა; ყველა მისი მოწყობილობის საიმედო იდენტიფიკაცია დასრულებული არ არის. ამიტომ ქვემოთ მოყვანილი მონაცემები რეალური მყიდველების ქცევად ან კონვერსიის მაჩვენებლად არ უნდა ჩაითვალოს.

ორი დამოუკიდებლად გამეორებული ხარვეზი გასწორდა: პაროლის აღდგენისას საწყისი მისამართის დაკარგვა და რეგისტრაციის/Google-ის უკუკავშირის ხელმისაწვდომობა. გამოქვეყნების ჩავარდნა, გაუმართავი გალერეა ან სხვა ხუთი დადასტურებული UX ხარვეზი ამ მტკიცებულებებით არ დასტურდება.

## Scope and provenance

- Repository: `bulbula93/samosell-lunching2`.
- Branch: `ux/clarity-audit-20261109`.
- Fetched base: `3acc5680c2d9a47a547ddcba0c0362dfffe00e6e` (`origin/main`).
- Collection date: 2026-11-09, Asia/Tbilisi; Clarity range: **Last 3 days**.
- Evidence came from the authenticated Clarity UI, event timelines, selected replay frames, heatmap rankings/scroll tables, and repository tests.
- Clarity AI summaries were visible, but their interpretations were not accepted as proof of failure, frustration, successful authentication, or publication.
- Masked text, unavailable screenshots, native dialogs and missing server outcomes limit interpretation. Masking was not changed.
- No raw recording exports, actual visitor/session identifiers, private conversation paths, personal information or recording screenshots are committed.

## Verified aggregate baseline

Evidence **DASHBOARD**: [Clarity dashboard](https://clarity.microsoft.com/projects/view/zadx2kl1ea/dashboard?date=Last+3+days), initial refreshed snapshot, without internal-traffic exclusions.

| Metric | Observed value |
| --- | --- |
| Sessions | 40 |
| Unique users | 21 |
| Pages per session | 5.80 |
| Average scroll depth | 51.47% |
| Active time | 1.7 minutes, of 4.6 minutes total |
| Rage clicks | 1 session / 2.50% |
| Dead clicks | 9 sessions / 22.50% |
| Quick backs | 20 sessions / 50% |
| Bot sessions explicitly excluded by Clarity | 0 |
| Performance sample | 27 pageviews; score 47/100 |
| LCP / INP / CLS displayed | 2.2 seconds / 680 ms / 2.4 |
| JavaScript errors | 3 errors in 2.50% of sessions; `maximum call stack size exceeded.` |

These confirm the supplied preliminary baseline, not a defect rate among genuine customers. Zero flagged bots does not prove all visits are human. The dashboard continued updating during the audit; later cards were not used to construct a matched before/after comparison.

## Internal traffic and owner exclusion

Evidence **COHORT**: recordings metadata showed an admin visitor reaching `/admin` and `/admin/social`, and a separate Preview-host visit. The owner confirmed same-day Chrome and iPhone use.

1. Two dead-click candidates associated with admin activity were screened out of customer-UX findings. They do not justify changes to customer flows.
2. Applied the UI's **Exclude Clarity user ID** filter for the confirmed admin browser. No actual identifier is reproduced here; the temporary filter was not saved as a shared segment or project setting.
3. The popular-pages homepage count changed from 63 to 49 visits after this exclusion at that inspection point. This establishes material internal-traffic contamination, not conversion improvement.
4. iPhone/Safari recordings remain quarantined from genuine-customer conclusions because the owner's corresponding identity has not been reliably separated. Other sampled visitors are also not verified as genuine customers.
5. Heatmap values below exclude one confirmed internal browser only. They still contain potentially internal visits and must not be represented as a clean customer cohort.

For future collection, the existing consent preference can disable optional analytics in each of the owner's browsers. Inspection of `components/privacy/OptionalAnalytics.tsx` confirmed Clarity is loaded only with analytics consent. No preference was changed on the owner's behalf. An explicit device opt-out plus exclusion for authenticated admin accounts is a recommendation, not implemented in this PR. Admin-only exclusion cannot identify logged-out activity. Avoid sending email addresses or other personal data as analytics labels.

Clarity supports [visitor filters and saved segments](https://learn.microsoft.com/en-us/clarity/filters/clarity-filters), [custom tags](https://learn.microsoft.com/en-us/clarity/filters/custom-tags), and [IP blocking](https://learn.microsoft.com/en-us/clarity/setup-and-installation/ip-exclusion). IP blocking is not a sufficient primary mechanism for changing/mobile IPs. Filtering a recording out of analysis does not stop its collection.

## Recordings inspected

Evidence **REPLAY**: [Recordings](https://clarity.microsoft.com/projects/view/zadx2kl1ea/recordings?date=Last+3+days), **Dead clicks = Yes**. All nine candidates were screened; seven non-admin candidates had event timelines and selected replay points sampled. Two admin candidates were excluded. This is not nine full recording reviews. Five of the seven sampled timelines also contained quick-back events; the full set of 20 quick-back recordings was not reviewed.

The rows below describe inspection contexts, not genuine-customer attribution. No customer-frequency conclusions are drawn from them.

| Sampled context | Device shown | Observed behavior | Assessment |
| --- | --- | --- | --- |
| Product detail | ChromeMobile | One dead-click marker after an earlier click; same product route; long hidden-page interval | Masked target and absent server outcome prevent confirmation of a broken control. Hidden time is not active engagement. |
| Sell → login → recovery → registration → dashboard | ChromeMobile | Login initially carried `next=/dashboard/listings/new`; recovery lacked `next`; subsequent login and registration defaulted to `/` | Loss of return destination is corroborated by code and failing component tests. Failed credentials or OAuth failure cannot be inferred from masked messages. |
| Home → catalog pages → product → catalog | MobileSafari | Multiple short product visits and successful subsequent pagination; a dead-click marker was followed by page navigation | Plausible normal browsing; insufficient evidence of broken pagination. Quarantined from customer inference. |
| Profile → store setup → profile → chats → new listing | MobileSafari | A chat-page dead click; subsequent thread navigation; new-listing route reached | Does not establish login or publication failure. Quarantined from customer inference. |
| Profile/listings → new listing → product | PC/Chrome | Several dead/rage markers, including details-stage controls; inputs continued and a product page was reached | Native controls can produce ambiguous replay signals. Product navigation alone does not prove successful publication. |
| New listing/profile → repeated selling flows → product/promotion | MobileSafari | Repeated form inputs, later product/promotion routes, multiple tabs and long hidden intervals | Neither the number of publish attempts nor successful database writes is known. Quarantined from customer inference. |
| Multiple product tabs | ChromeMobile | Final-tab dead click near session end; replay at the seek point was unavailable/loading | No reliable target or root cause; no gallery fix justified. |

On the return-destination timeline, the relevant relative events were login with a listing destination at 00:03, recovery at 00:33, login without that destination at 00:45, and registration with `next=/` at 00:50. These timings describe the navigation evidence only; they do not establish the visitor's identity.

## Heatmaps: mobile and PC separately

Evidence **HEATMAPS**: [Heatmaps](https://clarity.microsoft.com/projects/view/zadx2kl1ea/heatmaps?date=Last+3+days), Last 3 days, one confirmed internal browser excluded. Each popular-page URL pattern included its query-string variants. Device tabs and both click/tap and scroll modes were inspected. Dead-click recording filters were removed; Clarity says that recording filter does not apply to heatmaps.

These are the UI's pageview and click/tap counts, not distinct people or conversions. Screenshot samples and form stages can differ between visits. The 50% column transcribes the scroll table's reach, not average scroll depth.

| Page | Device | Pageviews | Clicks/taps | Reach at 50% page depth |
| --- | --- | ---: | ---: | --- |
| `/` | Mobile | 45 | 44 | 7 / 15.56% |
| `/` | PC | 4 | 1 | Scrollmap inspected; exact 50% row not transcribed |
| `/catalog` | Mobile | 18 | 16 | 10 / 55.56% |
| `/catalog` | PC | 1 | 1 | 0 / 0% |
| `/dashboard/listings/new` | Mobile | 19 | 184 | 14 / 73.68% |
| `/dashboard/listings/new` | PC | 1 | 30 | 1 / 100% |
| `/sell` | Mobile | 12 | 15 | 6 / 50% |
| `/sell` | PC | Not available | No clicks found | No scroll information found |
| `/login` | Mobile | 15 | 14 | 4 / 26.67% |
| `/login` | PC | Not available | No clicks found | No scroll information found |
| `/dashboard/profile` | Mobile | 14 | 40 | 6 / 42.86% |
| `/dashboard/profile` | PC | 3 | 8 | 2 / 66.67% |

Observed patterns and limits:

- **Homepage:** mobile interaction included bottom navigation and a PWA prompt. The sample prompt visually covered part of the hero. This is a follow-up QA lead; the sampled page version, owner's activity and actual obstruction of a working CTA are not established. The PC map had only one click.
- **Catalog:** the mobile map showed interaction with navigation and filtering areas. Several quick-back paths returned to catalog after product inspection. Neither filter-state loss nor broken links was reproduced here; PC evidence is too sparse for layout conclusions.
- **Listing creation:** tap rankings included a select, a disclosure summary and continuation controls; the sampled mobile view showed a bottom action bar. Different steps and the phone-required state share a URL. Counts do not prove upload or publish failures, form abandonment, or which required field blocked a visitor.
- **Sell:** the primary CTA accounted for 12 of 15 mobile taps (80%) in the displayed ranking. This proves interaction, not successful authentication or conversion. A span also received a tap, but it may belong to an interactive ancestor.
- **Login:** taps appeared on inputs, Google sign-in, recovery and password visibility controls. The displayed mobile scroll reach cannot establish failure to see the submit button, since page lengths, keyboards and sampled states vary. PC maps had no data.
- **Profile:** interactions included an image, file input and textarea. Clicks on labels, images or children of controls are not by themselves dead controls. Three PC pageviews do not establish widespread confusion.

No element is classified as ignored, broken, or inaccessible solely from the absence or presence of heatmap clicks. No pixel coordinates are asserted. No speculative visual redesign was implemented.

## Confirmed defects and root causes

### P1 — Password recovery loses the intended destination

Evidence: **REPLAY** navigation sequence; `LoginForm` hard-coded `/forgot-password`; the recovery page hard-coded `/login`; the reset callback and completion path also dropped the original destination. New behavioral tests failed before the correction.

Expected: starting sign-in while creating a listing must preserve that internal destination through a recovery detour. Actual: the user could end at the homepage and need to find listing creation again.

Correction: reuse the existing safe-redirect validator in a small auth-path builder; carry the destination through recovery, reset, cancel/back links, successful reset, and expired-code recovery. Old links without a destination keep the homepage default. No credential checks or phone/publication rules changed.

### P1 — Registration and Google feedback lack announcement semantics

Evidence: `RegisterForm` error/success feedback and `SocialAuthButtons` errors rendered ordinary `div` elements without alert/status semantics. Component tests reproduced the missing accessible feedback; all three new feedback tests failed before the correction.

Correction: `role="alert"` for errors and `role="status"` for registration confirmation instructions. Visual styling and business behavior are preserved. This establishes DOM accessibility semantics; real screen-reader speech has not been tested.

## Recommendations and unconfirmed risks

| Priority | Action | Evidence / release condition |
| --- | --- | --- |
| P0 measurement | Establish owner/test-device opt-out and a clean customer cohort before interpreting conversion or friction rates | **COHORT**; user-confirmed Chrome/iPhone activity; Preview/admin visits. Permanent tracking changes require a separately reviewed implementation and Production approval. |
| P1 | Review the two implemented auth/accessibility fixes in isolated QA | Independently reproduced defects above; see implementation report. |
| P1 investigation | Reassess INP/CLS on a clean cohort and identify the actual affected route/interaction | **DASHBOARD** has poor aggregate values; causal attribution is missing. Existing [PR #117](https://github.com/bulbula93/samosell-lunching2/pull/117) already covers homepage CLS diagnostics; do not duplicate it. |
| P1 investigation | Obtain a sanitized stack/source location for the stack-overflow errors if they occur in genuine-customer sessions | Three aggregate errors without a verified owning component are not enough to patch code. |
| P1 QA | Verify Google OAuth, recovery email delivery, phone prerequisite, photo selection/upload and publication using disposable QA accounts/storage | Local tests mock these boundaries; no live QA backend was exercised. Never use Production users for this. |
| P2 | Recheck PWA prompt and fixed navigation against the current build on narrow/mobile viewports | Heatmap sample shows overlap; actual obstruction and version need independent reproduction. |
| P2 | Expand quick-back sampling after internal traffic separation | Only five overlapping sampled timelines; normal browsing must remain distinct from broken navigation. |

Open PRs and branches were inventoried before branching. Search-state work already exists in [PR #78](https://github.com/bulbula93/samosell-lunching2/pull/78); message CTA work in [PR #113](https://github.com/bulbula93/samosell-lunching2/pull/113), and broader CPU work in [PR #137](https://github.com/bulbula93/samosell-lunching2/pull/137). Their areas were not modified. The base also includes the recent footer/listing UI work.

## Verdict

**NOT READY for Production.** The two code corrections are automated-test verified. A complete customer-only Clarity audit, exhaustive quick-back review, live desktop/mobile QA, physical iPhone testing, assistive-technology testing and disposable-backend authentication/upload/publication verification remain open. No Production deployment, merge, database migration, paid service, real payment or notification was performed.
