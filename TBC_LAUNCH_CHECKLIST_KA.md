# TBC Checkout — approval-day checklist

1. მიიღე TBC production merchant approval
2. მიიღე/დაადასტურე production API key
3. მიიღე/დაადასტურე Client ID
4. მიიღე/დაადასტურე Client Secret
5. callback დაარეგისტრირე: `https://samosell.ge/api/tbc/checkout/callback`
6. TBC-სთან დაადასტურე IP allowlist/signature/header მოთხოვნები
7. production credential-ები უსაფრთხოდ დაამატე Vercel-ში
8. env ცვლილებისთვის საჭიროების შემთხვევაში გააკეთე redeploy
9. production-ზე დატოვე `TBC_CHECKOUT_ENABLED=false`
10. ბანკის approval-ის შემდეგ გაუშვი ერთი კონტროლირებული checkout იზოლირებულ, წვდომით დაცულ preview/staging გარემოში; მხოლოდ ამ გარემოში ჩართე flag დროებით და გამოიყენე მისთვის დამტკიცებული callback
11. გადაამოწმე: order შეიქმნა; TBC redirect; წარმატებული გადახდა; callback; return; provider `Succeeded`; `paid_at`; boost მხოლოდ ერთხელ გააქტიურდა; billing სწორია; admin payment view სწორია
12. თუ TBC გარემო იძლევა, გამოცადე failed/cancelled payment
13. თუ provider გარემო იძლევა, გამოცადე refund/return
14. მხოლოდ წარმატებული შემოწმების შემდეგ დააყენე production-ზე `TBC_CHECKOUT_ENABLED=true`
15. redeploy/enable production checkout
16. პირველი გადახდები ხელით აკონტროლე `/admin/payments`-ში

სანამ ნაბიჯი 14 არ შესრულდება, production credential-ების არსებობის მიუხედავად checkout მომხმარებელს არ გამოუჩნდება. კოდში არ არსებობს სატესტო bypass ან მომხმარებელზე მიბმული ფარული გამონაკლისი.
