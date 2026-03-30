create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  full_name text not null,
  role varchar(20) not null check (role in ('buyer', 'seller')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  year integer not null,
  kilometers integer not null,
  fuel text not null,
  transmission text not null,
  price numeric(12,2) not null,
  province text not null,
  city text,
  description text not null,
  main_image_url text,
  image_urls text[],
  ai_status text,
  ai_damage_summary text,
  ai_price_range text,
  seller_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cars_brand on public.cars(brand);
create index if not exists idx_cars_model on public.cars(model);
create index if not exists idx_cars_price on public.cars(price);
create index if not exists idx_cars_year on public.cars(year);
create index if not exists idx_cars_seller_id on public.cars(seller_id);
