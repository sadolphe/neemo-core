-- Enable RLS
alter table public.shops enable row level security;

-- Customers Table
create table public.customers (
  id uuid default gen_random_uuid() primary key,
  shop_id uuid references public.shops(id) not null,
  name text not null,
  phone text,
  balance decimal default 0, -- Positif = Crédit (Le client a de l'avance), Négatif = Dette (Le client doit)
  created_at timestamp with time zone default now()
);

-- Enable RLS for Customers
alter table public.customers enable row level security;
create policy "Public Access Customers" on public.customers for all using (true);

-- Transactions Table
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  shop_id uuid references public.shops(id) not null,
  customer_id uuid references public.customers(id), -- Null if anonymous sale
  total_amount decimal not null,
  type text not null, -- 'SALE', 'CREDIT_ADD', 'DEBT_PAYMENT'
  items jsonb, -- Snapshot of products [{name, qty, price}]
  created_at timestamp with time zone default now()
);

-- Enable RLS for Transactions
alter table public.transactions enable row level security;
create policy "Public Access Transactions" on public.transactions for all using (true);
