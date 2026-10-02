insert into public.categories (name, slug, navigation_label, sort_order, is_active)
values
  ('ქალებისთვის', 'women', 'ქალებისთვის', 10, true),
  ('მამაკაცებისთვის', 'men', 'მამაკაცებისთვის', 20, true),
  ('ბავშვებისთვის', 'kids', 'ბავშვებისთვის', 30, true),
  ('ფეხსაცმელი', 'footwear', 'ფეხსაცმელი', 40, true),
  ('ჩანთები', 'bags', 'ჩანთები', 50, true),
  ('ვინტაჟი', 'vintage', 'ვინტაჟი', 60, true),
  ('აქსესუარები', 'accessories', 'აქსესუარები', 70, true),
  ('პარფიუმერია', 'perfume', 'პარფიუმერია', 80, true)
on conflict (slug) do update
set
  name = excluded.name,
  navigation_label = excluded.navigation_label,
  sort_order = excluded.sort_order,
  is_active = true;
