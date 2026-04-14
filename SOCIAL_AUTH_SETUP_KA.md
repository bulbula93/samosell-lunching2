# Google შესვლის დაყენება

ამ პროექტში სოციალური ავტორიზაციიდან დარჩენილია მხოლოდ:
- Google-ით შესვლა

## Supabase-ში

1. შედი **Authentication -> Providers**
2. ჩართე **Google**
3. **Facebook** დატოვე გამორთული
4. ჩასვი საჭირო Google Client ID / Secret

## Redirect URL-ები

Google OAuth callback უნდა ემთხვეოდეს Supabase-ის callback მისამართს, რომელსაც Providers გვერდზე ხედავ.

ლოკალურად ჩვეულებრივ დაგჭირდება მსგავსი მისამართები:
- `http://localhost:3000/auth/callback`

პროდუქციაში:
- `https://samosell.ge/auth/callback`
- ან შენი Vercel domain-ის callback

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
