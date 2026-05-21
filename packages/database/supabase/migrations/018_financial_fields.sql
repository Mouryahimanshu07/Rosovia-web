alter table public.orders
  add column if not exists tax_amount numeric not null default 0,
  add column if not exists gateway_fee numeric not null default 0,
  add column if not exists settlement_status text not null default 'not_ready',
  add column if not exists settled_at timestamptz null;

alter table public.orders
  add constraint orders_tax_amount_check check (tax_amount >= 0);

alter table public.orders
  add constraint orders_gateway_fee_check check (gateway_fee >= 0);

alter table public.orders
  add constraint orders_settlement_status_check check (
    settlement_status in ('not_ready', 'pending', 'settled', 'failed', 'on_hold')
  );