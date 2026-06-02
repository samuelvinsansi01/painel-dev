-- V24 — reforço de isolamento por user_id + user_email nos chips WhatsApp
-- Rode depois de criar a coluna user_email em public.whatsapp_instances.

alter table public.whatsapp_instances
  add column if not exists user_email text;

-- Opcional: preencha manualmente o email do seu usuário atual antes de testar a conta correta.
-- update public.whatsapp_instances
-- set user_email = 'SEU_EMAIL_GOOGLE_AQUI', updated_at = now()
-- where user_id = auth.uid() and user_email is null;

create index if not exists idx_whatsapp_instances_user_email
  on public.whatsapp_instances (user_id, user_email);

alter table public.whatsapp_instances enable row level security;

drop policy if exists "whatsapp_instances_select_own" on public.whatsapp_instances;
drop policy if exists "whatsapp_instances_insert_own" on public.whatsapp_instances;
drop policy if exists "whatsapp_instances_update_own" on public.whatsapp_instances;
drop policy if exists "whatsapp_instances_delete_own" on public.whatsapp_instances;

create policy "whatsapp_instances_select_own"
  on public.whatsapp_instances
  for select
  using (auth.uid() = user_id);

create policy "whatsapp_instances_insert_own"
  on public.whatsapp_instances
  for insert
  with check (auth.uid() = user_id);

create policy "whatsapp_instances_update_own"
  on public.whatsapp_instances
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "whatsapp_instances_delete_own"
  on public.whatsapp_instances
  for delete
  using (auth.uid() = user_id);
