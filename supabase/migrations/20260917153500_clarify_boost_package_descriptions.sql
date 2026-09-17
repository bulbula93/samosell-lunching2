update public.listing_boost_products
set description = case id
  when 'vip_7d' then '7 დღით განცხადება მიიღებს VIP ბეჯს და გამოჩნდება მთავარი გვერდის „VIP განცხადებების“ ჰორიზონტალურ რიგში. Hero სივრცე მხოლოდ VIP MAX პაკეტისთვისაა.'
  when 'promoted_7d' then '7 დღით განცხადება მიიღებს TOP მონიშვნას და უფრო მაღალ promotion პრიორიტეტს კატალოგსა და შესაბამის კატეგორიებში. VIP რიგსა და Hero-ში TOP მარტო არ ხვდება.'
  when 'combo_7d' then '7 დღით ერთდროულად აქტიურდება VIP + TOP + VIP MAX: განცხადება გამოჩნდება VIP რიგში, მიიღებს მაღალ კატალოგის პრიორიტეტს და მოხვდება მთავარი გვერდის Hero carousel-ში.'
  when 'home_banner_7d' then '7 დღით განცხადება გამოჩნდება მთავარ გვერდზე დიდ სარეკლამო ბანერში, საიდანაც მომხმარებელი პირდაპირ განცხადების გვერდზე გადავა. ეს პაკეტი VIP/TOP სტატუსს ავტომატურად არ ამატებს.'
  else description
end
where id in ('vip_7d', 'promoted_7d', 'combo_7d', 'home_banner_7d');
