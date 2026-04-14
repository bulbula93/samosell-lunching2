# Phase 6 — Hero fix + banner slots + admin access notes

## რა შეიცვალა
- Hero headline შემცირდა და line-height გასწორდა, რომ ასოები აღარ გადავიდეს ერთმანეთზე.
- მოვაშორე უხეში მწვანე გადასვლა და გადავიყვანე უფრო რბილ, ნეიტრალურ ფონზე.
- დაემატა ორი სარეკლამო ბანერის placeholder:
  - Homepage hero banner
  - Catalog sponsor banner
- ბანერების CTA მიბმულია `/dashboard/billing` გვერდზე, როგორც დროებითი კომერციული წერტილი.

## სად ვნახო ცვლილებები
- `/`
- `/catalog`

## ადმინში შესვლა
- თუ `profiles.is_admin = true`, მაშინ:
  - header-ში გამოჩნდება `ადმინი` ღილაკი
  - პირდაპირ URL-ითაც შეგიძლია შეხვიდე: `/admin`
- თუ `is_admin = false`, სისტემა გადაგიყვანს `/dashboard`-ზე.
