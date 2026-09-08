# SamoSell Stories + Following v1

## პროდუქტის ქცევა

Stories არის SamoSell-ის 24-საათიანი სოციალური ფენა: ავტორიზებული მომხმარებელი აქვეყნებს ფოტოს ან მაქსიმუმ 15-წამიან ვიდეოს, სურვილისამებრ ურთავს 280-სიმბოლოიან წარწერას და საკუთარ აქტიურ განცხადებას. სტუმარი ხედავს აქტიურ საჯარო Stories-ს; Follow, პასუხი, mute, block, report და გამოქვეყნება ავტორიზაციას მოითხოვს. ერთ მომხმარებელს ერთდროულად მაქსიმუმ 10 აქტიური Story აქვს.

Homepage rail-ში თითო ავტორი ერთხელ ჩანს. გახსნისას ჯერ უნახავი Story იწყება; შემდეგ იმავე ავტორის მიმდევრობა და მომდევნო ავტორი. ფოტო 6 წამში გადადის, ვიდეო დასრულებისას. კლავიატურაზე მუშაობს მარცხენა/მარჯვენა ისარი და Escape.

## მონაცემთა ბაზა

- `user_follows` — მიმართულებითი follow კავშირი, self-follow და დუბლიკატი აკრძალულია.
- `stories` — კონტროლირებადი Storage path, ტიპი, caption, ერთი optional listing, ზუსტად 24-საათიანი expiry და soft delete.
- `story_views` — ავტორიზებულ viewer-ზე ერთი უნიკალური view; ავტორის self-view არ ითვლება.
- `story_mutes` — პირადი და შექცევადი Story mute.
- `story_listing_clicks` — მინიმალური first-party გადასვლის event; anonymous fingerprinting არ გამოიყენება.
- `story_reports` — არსებული moderation taxonomy/status/audit მიდგომასთან ინტეგრირებული რეპორტი.

ახალი ცხრილები RLS-ითაა დაცული. browser role-ს პირდაპირი mutation grant არ აქვს; mutation-ები ვიწრო `SECURITY DEFINER` RPC-ებით გადის და `auth.uid()`-ს ენდობა.

## Story ranking

AI/ML არ გამოიყენება. bounded კანდიდატებზე deterministic score ითვალისწინებს Follow-ს (+100), ავტორის ნივთის favorite-ს (+50), chat ურთიერთობას (+30), favorite category/brand affinity-ს (+25/+15), წინა Story reply-ს (+20), freshness-ს (0..30) და unseen Story-ს (+40). სრულად ნანახი sequence იკლებს. mute, block და suspended account გამოირიცხება. ანონიმურ feed-ში freshness, unseen/newness და მცირე Story-count diversity signal გამოიყენება.

## Follow

Follow/Unfollow ავტორიზებული RPC-ია. client ვერ აგზავნის `follower_id`-ს. ბლოკირებულ მხარეებს ერთმანეთის follow არ შეუძლიათ, self-follow და suspended target აკრძალულია. ბლოკის შექმნა ორმხრივ არსებულ follow კავშირებს შლის. საჯარო follower/following სიები pagination-იანია და `noindex,follow` metadata აქვს.

## Chat და direct chat

არსებული inbox შენარჩუნდა და გაფართოვდა `chat_type = listing | direct`-ით. listing chat-ს `listing_id` აუცილებლად აქვს; direct chat-ს — აუცილებლად `NULL`. canonical participant-pair unique index ერთი და იგივე ორ მომხმარებელს შორის duplicate direct chat-ს უშლის ხელს. არსებული listing chat flow უცვლელია.

Story reply იგივე chat სისტემაში შედის. აქტიურ საკუთარ linked listing-ზე პასუხი listing chat-ს იყენებს; სხვა შემთხვევაში direct chat-ს. მიმღები, owner და listing database state-იდან დგინდება. `clientRequestId` reply-ს idempotent-ს ხდის. expired/deleted Story-ის მედია chat-ში აღარ ჩანს, მაგრამ reply ტექსტი რჩება და UI აჩვენებს „Story აღარ არის ხელმისაწვდომი“.

## მედია და Storage

`story-media` bucket იყენებს `userId/storyId/randomUuid.ext` path-ს. signed upload server action ამზადებს, ხოლო publish-მდე server ამოწმებს auth-ს, path ownership-ს, actual magic bytes-ს, Storage MIME/size-ს, video duration-ს, active count-ს და linked listing ownership/status-ს. ფოტო browser-ში მაქსიმუმ 1080×1920-მდე მცირდება და WebP quality 0.82-ად ინახება; პატარა ფოტო არ იზრდება. Viewer იყენებს პირდაპირ Storage URL-ს (`img`/native `video`) და Vercel Image Optimization transformation-ს არ ქმნის.

Expired Story query-ით მაშინვე ქრება და cron არ სჭირდება. metadata რჩება chat reference-ისთვის. migration ამზადებს service-role-only cleanup candidate function-ს, რომელიც expiry-დან 7 დღის შემდეგ media path-ებს აბრუნებს; scheduler v1-ში არ ჩართულა.

## Moderation და უსაფრთხოება

Story menu-დან შესაძლებელია profile, mute, report და block; საკუთარი Story-ის წაშლაც იქვეა. Story reports არსებულ `/admin/reports` გვერდზე ჩანს. admin შეუძლია განხილვაში გადაყვანა, dismiss/resolve, Story-ის დამალვა ან არსებული user suspension მოქმედება. ყველა ასეთი ოპერაცია `moderation_audit_log`-ში იწერება. AI/Admin Agent-ს mutation უფლება არ დამატებია.

## Analytics

ავტორი ხედავს aggregate Views, Replies და Listing clicks რაოდენობას. viewer identities არ ჩანს. Anonymous click event ინახება user ID-ის გარეშე; უნიკალური anonymous views fingerprinting-ის გარეშე არ ითვლება.

## v1 შეზღუდვები

- ვიდეო server-side არ ტრანსკოდირდება; მხარდაჭერილია MP4/WebM და ბრაუზერმა თავად უნდა შეძლოს დაკვრა.
- anonymous view uniqueness არ იზომება.
- media cleanup scheduler ავტომატურად არ არის ჩართული.
- rail-ის კანდიდატები და payload განზრახ bounded არის; infinite loading v1-ში არ არის.
- Story notifications არ იგზავნება; მხოლოდ reply chat notification იყენებს არსებულ ინფრასტრუქტურას.

## მომავალი v2 იდეები (ამ ვერსიაში არ არის)

Highlights, Music, Filters, Sponsored Stories, Advanced interests, AI ranking, Follower-only Stories, Story notifications და Reposts.
