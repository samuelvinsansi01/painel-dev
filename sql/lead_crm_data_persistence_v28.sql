-- V28 — Persistência real da ficha do lead
-- Execute no Supabase SQL Editor antes de testar a v28.

alter table if exists public.leads
add column if not exists user_email text;

alter table if exists public.leads
add column if not exists crm_data jsonb not null default '{}'::jsonb;

create index if not exists idx_leads_user_email_v28
on public.leads(user_email);

create index if not exists idx_leads_crm_data_gin_v28
on public.leads using gin (crm_data);

alter table if exists public.leads enable row level security;

drop policy if exists "leads_select_own_v28" on public.leads;
create policy "leads_select_own_v28"
on public.leads for select
using (auth.uid() = user_id);

drop policy if exists "leads_insert_own_v28" on public.leads;
create policy "leads_insert_own_v28"
on public.leads for insert
with check (auth.uid() = user_id);

drop policy if exists "leads_update_own_v28" on public.leads;
create policy "leads_update_own_v28"
on public.leads for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Preencha email em leads antigos do usuário logado, quando possível.
-- Troque pelo email real se quiser executar pontualmente:
-- update public.leads
-- set user_email = 'seu-email-google@exemplo.com'
-- where user_id = auth.uid()
--   and (user_email is null or user_email = '');
