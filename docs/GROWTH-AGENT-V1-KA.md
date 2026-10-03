# SamoSell Growth Agent v1

## მიზანი

Growth Agent v1 არის read-only seller-acquisition copilot, რომლის მთავარი KPI-ებია:

- აქტიური განცხადებების რაოდენობა
- ახალი listing-ები 24 საათსა და 7 დღეში
- ახალი პროფილები 24 საათსა და 7 დღეში
- seller activation — 3+ აქტიური განცხადება
- warm seller-ები — 1–2 აქტიური განცხადება
- ახალი chat-ები 7 დღეში
- sold listing-ები 7 დღეში

Near-term supply target: 1,000 active listings.

## უსაფრთხოების საზღვარი

v1:

- კითხულობს მხოლოდ aggregate marketplace KPI-ებს;
- AI context-ში არ აგზავნის სახელს, email-ს, ტელეფონს, მისამართს ან message body-ს;
- ქმნის growth რეკომენდაციებს, campaign concepts-ს და content drafts-ს;
- არ აქვეყნებს სოციალურ ქსელებში;
- არ აგზავნის მასობრივ DM-ს;
- არ ცვლის Meta/TikTok ad budget-ს;
- არ ცვლის marketplace production მონაცემებს.

## Admin route

- `/admin/growth`
- API: `/api/admin/growth`

AI-ის გარეშე სისტემა deterministic fallback რეჟიმშიც მუშაობს.

## შემდეგი ფაზა

Approval-enabled integrations:

1. content draft → admin approval → publish
2. creator outreach draft → admin approval → send
3. campaign budget recommendation → explicit approval → change
4. scheduled daily growth report
