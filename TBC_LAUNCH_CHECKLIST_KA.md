# TBC Checkout — approval-day checklist

1. მიიღე TBC production merchant approval
2. მიიღე/დაადასტურე production API key
3. მიიღე/დაადასტურე Client ID
4. მიიღე/დაადასტურე Client Secret
5. callback დაარეგისტრირე: `https://samosell.ge/api/tbc/checkout/callback`
6. TBC-სთან დაადასტურე IP allowlist/signature/header მოთხოვნები
7. production credential-ები უსაფრთხოდ დაამატე Vercel-ში
8. env ცვლილებისთვის საჭიროების შემთხვევაში გააკეთე redeploy
9. დატოვე `TBC_CHECKOUT_ENABLED=false`
10. გაუშვი ერთი კონტროლირებული TBC checkout
11. გადაამოწმე: order შეიქმნა; TBC redirect; წარმატებული გადახდა; callback; return; provider `Succeeded`; `paid_at`; boost მხოლოდ ერთხელ გააქტიურდა; billing სწორია; admin payment view სწორია
12. თუ TBC გარემო იძლევა, გამოცადე failed/cancelled payment
13. თუ provider გარემო იძლევა, გამოცადე refund/return
14. მხოლოდ წარმატებული შემოწმების შემდეგ დააყენე `TBC_CHECKOUT_ENABLED=true`
15. redeploy/enable production checkout
16. პირველი გადახდები ხელით აკონტროლე `/admin/payments`-ში

სანამ ნაბიჯი 14 არ შესრულდება, credential-ების არსებობის მიუხედავად checkout მომხმარებელს არ გამოუჩნდება.
