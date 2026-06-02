-- Campos usados pelo cadastro persistente de chips por conta.
alter table if exists public.whatsapp_instances
  add column if not exists user_email text,
  add column if not exists chip_id text,
  add column if not exists name text,
  add column if not exists instance text,
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists whatsapp_instances_user_email_chip_id_idx
  on public.whatsapp_instances(user_id, user_email, chip_id);
