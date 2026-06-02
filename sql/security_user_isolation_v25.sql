-- V25 — isolamento multiusuário reforçado.
-- Rode no Supabase SQL Editor após subir o código.

alter table if exists public.whatsapp_instances
  add column if not exists user_email text;

create index if not exists idx_whatsapp_instances_user_email
  on public.whatsapp_instances(user_id, user_email);

-- RLS por user_id em todas as tabelas sensíveis.
alter table if exists public.leads enable row level security;
alter table if exists public.lead_notes enable row level security;
alter table if exists public.lead_history enable row level security;
alter table if exists public.lead_followups enable row level security;
alter table if exists public.operational_data enable row level security;
alter table if exists public.whatsapp_instances enable row level security;
alter table if exists public.whatsapp_messages enable row level security;
alter table if exists public.whatsapp_contact_map enable row level security;

create index if not exists idx_leads_user_id on public.leads(user_id);
create index if not exists idx_lead_notes_user_id on public.lead_notes(user_id);
create index if not exists idx_lead_history_user_id on public.lead_history(user_id);
create index if not exists idx_lead_followups_user_id on public.lead_followups(user_id);
create index if not exists idx_operational_data_user_id on public.operational_data(user_id);
create index if not exists idx_whatsapp_messages_user_id on public.whatsapp_messages(user_id);
create index if not exists idx_whatsapp_contact_map_user_id on public.whatsapp_contact_map(user_id);

-- Recria políticas de ownership por auth.uid().
do $$
declare t text;
begin
  foreach t in array array['leads','lead_notes','lead_history','lead_followups','operational_data','whatsapp_messages','whatsapp_contact_map','whatsapp_instances'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- Proteção adicional específica para chips: o front filtra também por user_email.
-- Preencha linhas antigas uma única vez:
-- update public.whatsapp_instances set user_email = 'SEU_EMAIL_GOOGLE' where user_id = 'SEU_USER_ID' and user_email is null;
