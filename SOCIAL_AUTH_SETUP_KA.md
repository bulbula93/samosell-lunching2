# Google შესვლის დაყენება

ამ პროექტში სოციალური ავტორიზაციიდან დარჩენილია მხოლოდ:
- Google-ით შესვლა

## Supabase-ში

1. შედი **Authentication -> Providers**
2. ჩართე **Google**
3. **Facebook** დატოვე გამორთული
4. ჩასვი საჭირო Google Client ID / Secret

## Redirect URL-ები

Google Cloud Console-ში **Authorized redirect URI** უნდა იყოს Supabase-ის callback (არა Next.js route):

- `https://lxsvjzbiuewgwpajqrwr.supabase.co/auth/v1/callback`

Supabase-ში **Authentication → URL Configuration**:

- Site URL: `https://samosell.ge`
- Redirect allow list: `https://samosell.ge/auth/callback`
- ლოკალური განვითარებისთვის დამატებით: `http://localhost:3000/auth/callback`

Production environment-ში ორივე ცვლადი canonical domain-ზე უნდა მიუთითებდეს:

- `NEXT_PUBLIC_SITE_URL=https://samosell.ge`
- `SITE_URL=https://samosell.ge`

აპლიკაცია Google flow-ს canonical `/auth/callback` route-ზე აბრუნებს, code-ს server-side ცვლის session cookie-ებში და მხოლოდ უსაფრთხო შიდა `next` მისამართზე გადადის.

## პროექტში რა შეიცვალა

- Facebook ავტორიზაციის ღილაკი ამოღებულია
- მხოლოდ Google სოციალური ავტორიზაცია დარჩა
- მაღაზიის საჯარო `Facebook` ლინკი პროფილში შენარჩუნებულია, რადგან ეს ავტორიზაცია არ არის

## Git

```bash
git add .
git commit -m "Remove Facebook auth"
git push origin main
```
