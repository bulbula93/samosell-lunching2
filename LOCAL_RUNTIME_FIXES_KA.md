# Local runtime fixes

ეს არქივი გასწორებულია იმ ტიპის ლოკალური პრობლემებისთვის, რაც შენს სქრინებზე ჩანდა:

- Turbopack dev runtime mismatch
- ძველი `.next` cache-ით გამოწვეული უცნაური runtime error-ები
- workspace root-ის არასწორი ამოცნობის რისკი

რაც შეიცვალა:

- `npm run dev` ახლა გაშვებამდე წმენდს `.next`/`.turbo` cache-ს და უშვებს `next dev --webpack`
- `npm run build` ასევე წმენდს cache-ს და იყენებს `next build --webpack`
- `next.config.ts`-ში დაემატა `turbopack.root: process.cwd()`
- დაემატა `scripts/clean-next-cache.mjs`

გამოყენება:

```powershell
npm install
npm run dev
```

თუ ოდესმე დაგჭირდება ხელით გაწმენდა:

```powershell
npm run clean
```
