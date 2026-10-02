insert into public.categories (name, slug, navigation_label, sort_order, is_active)
values ('პარფიუმერია', 'perfume', 'პარფიუმერია', 35, true)
on conflict (slug) do update
set
  name = excluded.name,
  navigation_label = excluded.navigation_label,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.sizes (group_name, label, sort_order)
values
  ('perfume', '15 ml', 10),
  ('perfume', '30 ml', 20),
  ('perfume', '50 ml', 30),
  ('perfume', '75 ml', 40),
  ('perfume', '100 ml', 50),
  ('perfume', '125 ml', 60),
  ('perfume', '150 ml', 70),
  ('perfume', '200 ml', 80)
on conflict (group_name, label) do update
set sort_order = excluded.sort_order;

insert into public.brands (name, slug, is_active)
values
  ('Chanel', 'chanel', true),
  ('Dior', 'dior', true),
  ('Giorgio Armani', 'giorgio-armani', true),
  ('Yves Saint Laurent', 'yves-saint-laurent', true),
  ('Tom Ford', 'tom-ford', true),
  ('Gucci', 'gucci', true),
  ('Prada', 'prada', true),
  ('Versace', 'versace', true),
  ('Dolce & Gabbana', 'dolce-gabbana', true),
  ('Burberry', 'burberry', true),
  ('Givenchy', 'givenchy', true),
  ('Hermès', 'hermes', true),
  ('Maison Francis Kurkdjian', 'maison-francis-kurkdjian', true),
  ('Creed', 'creed', true),
  ('Jo Malone', 'jo-malone', true),
  ('Narciso Rodriguez', 'narciso-rodriguez', true),
  ('Carolina Herrera', 'carolina-herrera', true),
  ('Jean Paul Gaultier', 'jean-paul-gaultier', true),
  ('Paco Rabanne', 'paco-rabanne', true),
  ('Montale', 'montale', true),
  ('Mancera', 'mancera', true),
  ('Byredo', 'byredo', true),
  ('Le Labo', 'le-labo', true),
  ('Diptyque', 'diptyque', true),
  ('Xerjoff', 'xerjoff', true)
on conflict (slug) do update
set
  name = excluded.name,
  is_active = true;
