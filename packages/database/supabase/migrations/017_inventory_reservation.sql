alter table public.listings
  add column if not exists reserved_stock integer not null default 0,
  add column if not exists sold_stock integer not null default 0;

alter table public.listings
  add constraint listings_reserved_stock_check check (reserved_stock >= 0);

alter table public.listings
  add constraint listings_sold_stock_check check (sold_stock >= 0);

alter table public.listings
  add constraint listings_stock_reservation_check check (
    stock is null or reserved_stock + sold_stock <= stock
  );

create index if not exists listings_stock_reservation_idx
  on public.listings(stock, reserved_stock, sold_stock);

