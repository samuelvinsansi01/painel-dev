-- Segurança multiusuário V23
-- Rode no SQL Editor do Supabase.
-- Objetivo: impedir que dados de uma conta Google apareçam em outra conta.

-- Todas as tabelas abaixo precisam ter user_id e usar RLS por auth.uid().

-- LEADS
alter table if exists public.leads enable row level security;
create index if not exists idx_leads_user_id on public.leads(user_id);
drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own" on public.leads for select using (auth.uid() = user_id);
drop policy if exists "leads_insert_own" on public.leads;
create policy "leads_insert_own" on public.leads for insert with check (auth.uid() = user_id);
drop policy if exists "leads_update_own" on public.leads;
create policy "leads_update_own" on public.leads for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "leads_delete_own" on public.leads;
create policy "leads_delete_own" on public.leads for delete using (auth.uid() = user_id);

-- LEAD NOTES
alter table if exists public.lead_notes enable row level security;
create index if not exists idx_lead_notes_user_id on public.lead_notes(user_id);
drop policy if exists "lead_notes_select_own" on public.lead_notes;
create policy "lead_notes_select_own" on public.lead_notes for select using (auth.uid() = user_id);
drop policy if exists "lead_notes_insert_own" on public.lead_notes;
create policy "lead_notes_insert_own" on public.lead_notes for insert with check (auth.uid() = user_id);
drop policy if exists "lead_notes_update_own" on public.lead_notes;
create policy "lead_notes_update_own" on public.lead_notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "lead_notes_delete_own" on public.lead_notes;
create policy "lead_notes_delete_own" on public.lead_notes for delete using (auth.uid() = user_id);

-- LEAD HISTORY
alter table if exists public.lead_history enable row level security;
create index if not exists idx_lead_history_user_id on public.lead_history(user_id);
drop policy if exists "lead_history_select_own" on public.lead_history;
create policy "lead_history_select_own" on public.lead_history for select using (auth.uid() = user_id);
drop policy if exists "lead_history_insert_own" on public.lead_history;
create policy "lead_history_insert_own" on public.lead_history for insert with check (auth.uid() = user_id);
drop policy if exists "lead_history_update_own" on public.lead_history;
create policy "lead_history_update_own" on public.lead_history for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "lead_history_delete_own" on public.lead_history;
create policy "lead_history_delete_own" on public.lead_history for delete using (auth.uid() = user_id);

-- LEAD FOLLOWUPS
alter table if exists public.lead_followups enable row level security;
create index if not exists idx_lead_followups_user_id on public.lead_followups(user_id);
drop policy if exists "lead_followups_select_own" on public.lead_followups;
create policy "lead_followups_select_own" on public.lead_followups for select using (auth.uid() = user_id);
drop policy if exists "lead_followups_insert_own" on public.lead_followups;
create policy "lead_followups_insert_own" on public.lead_followups for insert with check (auth.uid() = user_id);
drop policy if exists "lead_followups_update_own" on public.lead_followups;
create policy "lead_followups_update_own" on public.lead_followups for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "lead_followups_delete_own" on public.lead_followups;
create policy "lead_followups_delete_own" on public.lead_followups for delete using (auth.uid() = user_id);

-- WHATSAPP INSTANCES / CHIPS
alter table if exists public.whatsapp_instances enable row level security;
create index if not exists idx_whatsapp_instances_user_id on public.whatsapp_instances(user_id);
drop policy if exists "whatsapp_instances_select_own" on public.whatsapp_instances;
create policy "whatsapp_instances_select_own" on public.whatsapp_instances for select using (auth.uid() = user_id);
drop policy if exists "whatsapp_instances_insert_own" on public.whatsapp_instances;
create policy "whatsapp_instances_insert_own" on public.whatsapp_instances for insert with check (auth.uid() = user_id);
drop policy if exists "whatsapp_instances_update_own" on public.whatsapp_instances;
create policy "whatsapp_instances_update_own" on public.whatsapp_instances for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "whatsapp_instances_delete_own" on public.whatsapp_instances;
create policy "whatsapp_instances_delete_own" on public.whatsapp_instances for delete using (auth.uid() = user_id);

-- WHATSAPP CONTACT MAP
alter table if exists public.whatsapp_contact_map enable row level security;
create index if not exists idx_whatsapp_contact_map_user_instance_lid on public.whatsapp_contact_map(user_id, instance, lid);
drop policy if exists "whatsapp_contact_map_select_own" on public.whatsapp_contact_map;
create policy "whatsapp_contact_map_select_own" on public.whatsapp_contact_map for select using (auth.uid() = user_id);
drop policy if exists "whatsapp_contact_map_insert_own" on public.whatsapp_contact_map;
create policy "whatsapp_contact_map_insert_own" on public.whatsapp_contact_map for insert with check (auth.uid() = user_id);
drop policy if exists "whatsapp_contact_map_update_own" on public.whatsapp_contact_map;
create policy "whatsapp_contact_map_update_own" on public.whatsapp_contact_map for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "whatsapp_contact_map_delete_own" on public.whatsapp_contact_map;
create policy "whatsapp_contact_map_delete_own" on public.whatsapp_contact_map for delete using (auth.uid() = user_id);

-- WHATSAPP MESSAGES
alter table if exists public.whatsapp_messages enable row level security;
create index if not exists idx_whatsapp_messages_user_instance_phone on public.whatsapp_messages(user_id, instance, phone);
create index if not exists idx_whatsapp_messages_user_occurred_at on public.whatsapp_messages(user_id, occurred_at desc);
drop policy if exists "whatsapp_messages_select_own" on public.whatsapp_messages;
create policy "whatsapp_messages_select_own" on public.whatsapp_messages for select using (auth.uid() = user_id);
drop policy if exists "whatsapp_messages_insert_own" on public.whatsapp_messages;
create policy "whatsapp_messages_insert_own" on public.whatsapp_messages for insert with check (auth.uid() = user_id);
drop policy if exists "whatsapp_messages_update_own" on public.whatsapp_messages;
create policy "whatsapp_messages_update_own" on public.whatsapp_messages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "whatsapp_messages_delete_own" on public.whatsapp_messages;
create policy "whatsapp_messages_delete_own" on public.whatsapp_messages for delete using (auth.uid() = user_id);

-- OPERATIONAL DATA
alter table if exists public.operational_data enable row level security;
create index if not exists idx_operational_data_user_scope on public.operational_data(user_id, scope);
drop policy if exists "operational_data_select_own" on public.operational_data;
create policy "operational_data_select_own" on public.operational_data for select using (auth.uid() = user_id);
drop policy if exists "operational_data_insert_own" on public.operational_data;
create policy "operational_data_insert_own" on public.operational_data for insert with check (auth.uid() = user_id);
drop policy if exists "operational_data_update_own" on public.operational_data;
create policy "operational_data_update_own" on public.operational_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "operational_data_delete_own" on public.operational_data;
create policy "operational_data_delete_own" on public.operational_data for delete using (auth.uid() = user_id);
