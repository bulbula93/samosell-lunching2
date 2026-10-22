-- Run ONLY on SamoSell-QA (ydocqjdjmffysexkzxyc).
-- All fixtures, notifications and reviews are rolled back, even on failure.
begin;
create temporary table sale_qa_results (test text, result text) on commit drop;
insert into auth.users (id, email, raw_user_meta_data) values
 ('e2261022-0000-4000-8000-000000000001','sale-qa-seller-20261022@example.invalid','{"username":"sale_qa_seller_20261022","full_name":"Sale QA Seller"}'),
 ('e2261022-0000-4000-8000-000000000002','sale-qa-buyer-20261022@example.invalid','{"username":"sale_qa_buyer_20261022","full_name":"Sale QA Buyer"}'),
 ('e2261022-0000-4000-8000-000000000003','sale-qa-outsider-20261022@example.invalid','{"username":"sale_qa_outsider_20261022","full_name":"Sale QA Outsider"}');
update public.profiles set store_phone='+995555000000' where id='e2261022-0000-4000-8000-000000000001';
insert into public.listings(id,seller_id,category_id,title,slug,description,price,status,cover_image_url,published_at) values
 ('e226102a-0000-4000-8000-000000000011','e2261022-0000-4000-8000-000000000001',1,'Sale QA external','sale-qa-external-20261022','Disposable rollback-only sale attribution fixture',25,'active','https://ydocqjdjmffysexkzxyc.supabase.co/storage/v1/object/public/listings/sale-qa-fixture.webp',now()),
 ('e226102b-0000-4000-8000-000000000012','e2261022-0000-4000-8000-000000000001',1,'Sale QA SamoSell','sale-qa-samosell-20261022','Disposable rollback-only sale attribution fixture',30,'active','https://ydocqjdjmffysexkzxyc.supabase.co/storage/v1/object/public/listings/sale-qa-fixture.webp',now());
insert into public.chats(id,listing_id,buyer_id,seller_id) values
 ('e2261022-0000-4000-8000-000000000021','e226102b-0000-4000-8000-000000000012','e2261022-0000-4000-8000-000000000002','e2261022-0000-4000-8000-000000000001');
insert into public.messages(chat_id,sender_id,body) values
 ('e2261022-0000-4000-8000-000000000021','e2261022-0000-4000-8000-000000000002','Sale attribution QA buyer inquiry');

set local role authenticated;
select set_config('request.jwt.claim.sub','e2261022-0000-4000-8000-000000000001',true);
do $$ begin
 begin
  update public.listings set status='sold',sold_source='samosell',sold_to_user_id=null where id='e226102a-0000-4000-8000-000000000011';
  raise exception 'QA_FAIL: SamoSell without buyer accepted';
 exception when invalid_parameter_value then
  if sqlerrm <> 'sold_buyer_required' then raise; end if;
 end;
 begin
  update public.listings set status='sold',sold_source='external',sold_to_user_id='e2261022-0000-4000-8000-000000000002' where id='e226102a-0000-4000-8000-000000000011';
  raise exception 'QA_FAIL: external with buyer accepted';
 exception when invalid_parameter_value then
  if sqlerrm <> 'external_sale_buyer_not_allowed' then raise; end if;
 end;
 update public.listings set status='sold',sold_source='external',sold_to_user_id=null where id='e226102a-0000-4000-8000-000000000011';
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.listings where id='e226102a-0000-4000-8000-000000000011' and status='sold' and sold_source='external' and sold_to_user_id is null) then raise exception 'QA_FAIL: external attribution'; end if;
 if exists(select 1 from public.notifications where listing_id='e226102a-0000-4000-8000-000000000011' and type='review_request') then raise exception 'QA_FAIL: external notification'; end if;
end $$;
insert into sale_qa_results values ('SamoSell without buyer blocked','PASS'),('External with buyer blocked','PASS'),('External sold/source/null buyer','PASS'),('External review notification absent','PASS');

set local role anon;
do $$ begin
 if exists(select 1 from public.listings where id='e226102a-0000-4000-8000-000000000011') then raise exception 'QA_FAIL: sold listing visible to anonymous catalog'; end if;
end $$;
reset role;
insert into sale_qa_results values ('Sold listing hidden from anonymous catalog RLS','PASS');

set local role authenticated;
select set_config('request.jwt.claim.sub','e2261022-0000-4000-8000-000000000003',true);
do $$ declare affected integer; begin
 update public.listings set status='sold',sold_source='external' where id='e226102b-0000-4000-8000-000000000012';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'QA_FAIL: non-owner mutation'; end if;
end $$;
reset role;
insert into sale_qa_results values ('Non-owner cannot change listing status under RLS','PASS');

set local role authenticated;
select set_config('request.jwt.claim.sub','e2261022-0000-4000-8000-000000000001',true);
update public.listings set status='sold',sold_source='samosell',sold_to_user_id='e2261022-0000-4000-8000-000000000002' where id='e226102b-0000-4000-8000-000000000012';
update public.listings set status='sold',sold_source='samosell',sold_to_user_id='e2261022-0000-4000-8000-000000000002' where id='e226102b-0000-4000-8000-000000000012';
reset role;
do $$ begin
 if not exists(select 1 from public.listings where id='e226102b-0000-4000-8000-000000000012' and status='sold' and sold_source='samosell' and sold_to_user_id='e2261022-0000-4000-8000-000000000002') then raise exception 'QA_FAIL: SamoSell attribution'; end if;
 if (select count(*) from public.notifications where listing_id='e226102b-0000-4000-8000-000000000012' and type='review_request' and user_id='e2261022-0000-4000-8000-000000000002') <> 1 then raise exception 'QA_FAIL: review notification cardinality'; end if;
end $$;
insert into sale_qa_results values ('SamoSell sold/source/verified buyer','PASS'),('Selected buyer receives exactly one review request after repeat update','PASS');

set local role authenticated;
select set_config('request.jwt.claim.sub','e2261022-0000-4000-8000-000000000003',true);
do $$ begin
 begin
  perform public.upsert_listing_review('e226102b-0000-4000-8000-000000000012',5,'Unauthorized QA review');
  raise exception 'QA_FAIL: outsider review accepted';
 exception when raise_exception then
  if sqlerrm <> 'review_not_allowed' then raise; end if;
 end;
end $$;
select set_config('request.jwt.claim.sub','e2261022-0000-4000-8000-000000000002',true);
do $$ begin
 begin
  perform public.upsert_listing_review('e226102a-0000-4000-8000-000000000011',5,'External sale review');
  raise exception 'QA_FAIL: external review accepted';
 exception when raise_exception then
  if sqlerrm <> 'review_not_allowed' then raise; end if;
 end;
 perform public.upsert_listing_review('e226102b-0000-4000-8000-000000000012',5,'Verified QA buyer review');
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.listing_reviews where listing_id='e226102b-0000-4000-8000-000000000012' and reviewer_id='e2261022-0000-4000-8000-000000000002') then raise exception 'QA_FAIL: verified review missing'; end if;
end $$;
insert into sale_qa_results values ('Outsider review rejected by real RPC','PASS'),('External sale review rejected by real RPC','PASS'),('Verified buyer review accepted by real RPC','PASS');

set local role authenticated;
select set_config('request.jwt.claim.sub','e2261022-0000-4000-8000-000000000001',true);
update public.listings set status='active' where id in ('e226102a-0000-4000-8000-000000000011','e226102b-0000-4000-8000-000000000012');
reset role;
do $$ begin
 if (select count(*) from public.listings where id in ('e226102a-0000-4000-8000-000000000011','e226102b-0000-4000-8000-000000000012') and status='active' and sold_source is null and sold_to_user_id is null) <> 2 then raise exception 'QA_FAIL: reopen attribution reset'; end if;
end $$;
insert into sale_qa_results values ('Reopen clears source and buyer for both sale types','PASS');
select * from sale_qa_results;
rollback;
