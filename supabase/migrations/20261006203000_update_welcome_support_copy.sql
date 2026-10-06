-- Update the SamoSell Help welcome copy and keep the support thread idempotent.
-- The clickable "დაიწყე ახლავე" CTA is rendered by the chat UI for the first
-- official support message and links to /dashboard/listings/new.

do $$
declare
  v_old_body text := '👋 გამარჯობა!

მადლობა, რომ შემოუერთდი SamoSell-ს 💛

აქ შეგიძლია მარტივად გაყიდო ნივთები, რომლებიც აღარ გჭირდება — ტანსაცმელი, ფეხსაცმელი, აქსესუარები, პარფიუმერია და სხვა.

📸 როგორ გაყიდო უფრო სწრაფად?
• ატვირთე ნათელი და ხარისხიანი ფოტოები
• აღწერე ნივთის რეალური მდგომარეობა
• მიუთითე სამართლიანი ფასი
• სწრაფად უპასუხე დაინტერესებულ ადამიანებს ჩათში 💬

✨ პატარა რჩევა: რამდენიმე განცხადების დამატება ზრდის შანსს, რომ შენი ნივთები უფრო მეტმა ადამიანმა ნახოს.

თუ რამე კითხვა გაქვს ან დახმარება დაგჭირდება, მოგვწერე პირდაპირ ამ ჩათში — SamoSell-ის გუნდი გიპასუხებს.

SamoSell გუნდი 💛';
  v_new_body text := 'გამარჯობა!

მადლობა, რომ შემოუერთდი SamoSell-ს 💛

აქ შეგიძლია მარტივად გაყიდო ნივთები, რომლებიც აღარ გჭირდება - ტანსაცმელი, ფეხსაცმელი, აქსესუარები, პარფიუმერია და სხვა

📸 როგორ გაყიდო სწრაფად?!
• ატვირთე ნათელი და ხარისხიანი ფოტოები
• აღწერე ნივთის რეალური მდგომარეობა
• მიუთითე შენთვის მისაღები ფასი
• სწრაფად უპასუხე დაინტერესებულ ადამიანებს ჩათში 💬

პატარა რჩევა : რამდენიმე განცხადების დამატება ზრდის შანსს, რომ შენი ნივთები უფრო მეტმა ადამიანმა ნახოს

თუ რამე კითხვა გექნება ან დახმარება დაგჭირდება, მოგვწერე პირდაპირ ამ ჩათში - ჩვენი გუნდი მალევე გიპასუხებს

SamoSell - ის გუნდი 💛';
begin
  update public.messages m
  set body = v_new_body
  from public.chats c
  where c.id = m.chat_id
    and c.chat_type = 'support'
    and m.sender_id = c.seller_id
    and m.body = v_old_body;
end;
$$;

create or replace function public.create_welcome_support_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_support_admin_id uuid;
  v_chat_id uuid;
  v_message_id uuid;
  v_welcome_body text := 'გამარჯობა!

მადლობა, რომ შემოუერთდი SamoSell-ს 💛

აქ შეგიძლია მარტივად გაყიდო ნივთები, რომლებიც აღარ გჭირდება - ტანსაცმელი, ფეხსაცმელი, აქსესუარები, პარფიუმერია და სხვა

📸 როგორ გაყიდო სწრაფად?!
• ატვირთე ნათელი და ხარისხიანი ფოტოები
• აღწერე ნივთის რეალური მდგომარეობა
• მიუთითე შენთვის მისაღები ფასი
• სწრაფად უპასუხე დაინტერესებულ ადამიანებს ჩათში 💬

პატარა რჩევა : რამდენიმე განცხადების დამატება ზრდის შანსს, რომ შენი ნივთები უფრო მეტმა ადამიანმა ნახოს

თუ რამე კითხვა გექნება ან დახმარება დაგჭირდება, მოგვწერე პირდაპირ ამ ჩათში - ჩვენი გუნდი მალევე გიპასუხებს

SamoSell - ის გუნდი 💛';
begin
  begin
    select p.id
      into v_support_admin_id
    from public.profiles p
    where p.is_admin
      and not p.is_suspended
      and p.id <> new.id
    order by p.created_at asc, p.id asc
    limit 1;

    if v_support_admin_id is null then
      return new;
    end if;

    insert into public.chats (
      listing_id,
      buyer_id,
      seller_id,
      chat_type,
      buyer_last_read_at,
      seller_last_read_at
    )
    values (
      null,
      new.id,
      v_support_admin_id,
      'support',
      null,
      clock_timestamp()
    )
    on conflict (buyer_id) where chat_type = 'support'
      do nothing
    returning id into v_chat_id;

    if v_chat_id is null then
      select c.id
        into v_chat_id
      from public.chats c
      where c.chat_type = 'support'
        and c.buyer_id = new.id
      limit 1;
    end if;

    if v_chat_id is null then
      return new;
    end if;

    select m.id
      into v_message_id
    from public.messages m
    where m.chat_id = v_chat_id
      and m.sender_id = v_support_admin_id
      and m.body = v_welcome_body
    order by m.created_at asc
    limit 1;

    if v_message_id is null then
      insert into public.messages (
        chat_id,
        sender_id,
        body,
        message_type,
        story_id
      )
      values (
        v_chat_id,
        v_support_admin_id,
        v_welcome_body,
        'text',
        null
      )
      returning id into v_message_id;
    end if;

    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      href,
      actor_id,
      chat_id,
      event_key,
      metadata
    )
    values (
      new.id,
      'chat_message',
      'კეთილი იყოს შენი მობრძანება SamoSell-ში 💛',
      'SamoSell Help-ში დაგხვდა მოკლე გზამკვლევი და აქვე შეგიძლია დახმარებისთვის მოგვწერო.',
      '/dashboard/chats/' || v_chat_id::text,
      v_support_admin_id,
      v_chat_id,
      'support_welcome:' || new.id::text,
      jsonb_build_object(
        'message_id', v_message_id,
        'official_support', true,
        'welcome', true
      )
    )
    on conflict (event_key) do nothing;
  exception
    when others then
      raise warning 'welcome support chat skipped for profile %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.create_welcome_support_chat() from public, anon, authenticated;

notify pgrst, 'reload schema';
