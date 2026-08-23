-- Allow half-star ratings (e.g. 3.5) alongside whole-star ones.
alter table public.books
  alter column rating type numeric(2,1) using rating::numeric(2,1);

alter table public.books
  drop constraint books_rating_check;

alter table public.books
  add constraint books_rating_check
  check (rating between 1 and 5 and rating * 2 = round(rating * 2));
