create table if not exists public.bookings (
  id text primary key,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  customer_licence text not null,
  car_id integer not null,
  car_name text not null,
  pickup date not null,
  return_date date not null,
  pickup_point text not null,
  extras jsonb not null default '[]'::jsonb,
  days integer not null,
  base_cost numeric not null,
  extras_cost numeric not null,
  total numeric not null,
  status text not null default 'CONFIRMED',
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

create policy "Allow public booking inserts"
on public.bookings
for insert
to anon
with check (true);
