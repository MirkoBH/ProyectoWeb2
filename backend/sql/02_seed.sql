insert into public.users (id, email, password_hash, full_name, role)
values
  ('11111111-1111-1111-1111-111111111111', 'seller@automarket.dev', '$2b$10$J5Wug9jxKuh9mBxxl2tZv.j.t8rXlhJJ85t3RJCm2W.FexQhtV0ye', 'Seller Demo', 'seller'),
  ('22222222-2222-2222-2222-222222222222', 'buyer@automarket.dev', '$2b$10$J5Wug9jxKuh9mBxxl2tZv.j.t8rXlhJJ85t3RJCm2W.FexQhtV0ye', 'Buyer Demo', 'buyer')
on conflict (email) do nothing;

insert into public.cars (
  id, brand, model, year, kilometers, fuel, transmission, price, province, city,
  description, main_image_url, ai_status, ai_damage_summary, ai_price_range, seller_id
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Toyota', 'Corolla', 2020, 68000, 'Nafta', 'Automatica', 18500,
    'Buenos Aires', 'La Plata',
    'Mantenimiento al dia, unico duenio.',
    'https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1200&q=80',
    'good', 'Sin danos visibles relevantes', 'USD 17.800 - 19.300',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Volkswagen', 'Amarok', 2021, 54000, 'Diesel', 'Automatica', 34200,
    'Mendoza', 'Godoy Cruz',
    'Doble cabina, historial completo.',
    'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1200&q=80',
    'excellent', 'Sin danos detectados', 'USD 33.100 - 35.500',
    '11111111-1111-1111-1111-111111111111'
  )
on conflict (id) do nothing;

-- Credenciales demo
-- seller@automarket.dev / 123456
-- buyer@automarket.dev / 123456
