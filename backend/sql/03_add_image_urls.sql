alter table if exists public.cars
add column if not exists image_urls text[];

update public.cars
set image_urls = array[main_image_url]
where image_urls is null and main_image_url is not null;
