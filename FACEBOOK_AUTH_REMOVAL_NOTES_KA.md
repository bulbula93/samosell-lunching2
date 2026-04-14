# Facebook ავტორიზაციის ამოღების ჩანაწერები

## რა შეიცვალა
- `components/auth/SocialAuthButtons.tsx`
  - Facebook provider ამოღებულია
  - დარჩა მხოლოდ Google OAuth ღილაკი
- `SOCIAL_AUTH_SETUP_KA.md`
  - ინსტრუქცია განახლებულია Google-only ვერსიაზე
- დამატებულია ეს ფაილი დოკუმენტაციისთვის

## რა არ შეცვლილა
- `store_facebook` ველები და მაღაზიის Facebook ბმულები **დატოვებულია**, რადგან ეს არის პროფილის სოციალური ბმულები და არა ავტორიზაცია.

## დამატებითი რეკომენდაცია
Supabase Dashboard-ში თუ Facebook provider ჩართული გაქვს, გამორთე:
- Authentication -> Providers -> Facebook -> Disable

## სწრაფი ტესტი
1. `npm install`
2. `npm run dev`
3. გახსენი `/login`
4. უნდა ჩანდეს მხოლოდ Google ღილაკი
5. email/password login და register ჩვეულებრივ უნდა მუშაობდეს
