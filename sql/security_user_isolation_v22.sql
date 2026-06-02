-- Segurança multiusuário: impedir vazamento entre contas no Supabase.
-- Rode no SQL Editor do Supabase.

-- whatsapp_instances
alter table public.whatsapp_instances enable row level security;

drop policy if exists "whatsapp_instances_select_own" on public.whatsapp_instances;
create policy "whatsapp_instances_select_own"
on public.whatsapp_instances for select
using (auth.uid() = user_id);

drop policy if exists "whatsapp_instances_insert_own" on public.whatsapp_instances;
create policy "whatsapp_instances_insert_own"
on public.whatsapp_instances for insert
with check (auth.uid() = user_id);

drop policy if exists "whatsapp_instances_update_own" on public.whatsapp_instances;
create policy "whatsapp_instances_update_own"
on public.whatsapp_instances for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "whatsapp_instances_delete_own" on public.whatsapp_instances;
create policy "whatsapp_instances_delete_own"
on public.whatsapp_instances for delete
using (auth.uid() = user_id);

create index if not exists idx_whatsapp_instances_user_id
on public.whatsapp_instances(user_id);

-- whatsapp_contact_map
alter table public.whatsapp_contact_map enable row level security;

drop policy if exists "whatsapp_contact_map_select_own" on public.whatsapp_contact_map;
create policy "whatsapp_contact_map_select_own"
on public.whatsapp_contact_map for select
using (auth.uid() = user_id);

drop policy if exists "whatsapp_contact_map_insert_own" on public.whatsapp_contact_map;
create policy "whatsapp_contact_map_insert_own"
on public.whatsapp_contact_map for insert
with check (auth.uid() = user_id);

drop policy if exists "whatsapp_contact_map_update_own" on public.whatsapp_contact_map;
create policy "whatsapp_contact_map_update_own"
on public.whatsapp_contact_map for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "whatsapp_contact_map_delete_own" on public.whatsapp_contact_map;
create policy "whatsapp_contact_map_delete_own"
on public.whatsapp_contact_map for delete
using (auth.uid() = user_id);

create index if not exists idx_whatsapp_contact_map_user_instance_lid
on public.whatsapp_contact_map(user_id, instance, lid);

-- whatsapp_messages
alter table public.whatsapp_messages enable row level security;

drop policy if exists "whatsapp_messages_select_own" on public.whatsapp_messages;
create policy "whatsapp_messages_select_own"
on public.whatsapp_messages for select
using (auth.uid() = user_id);

drop policy if exists "whatsapp_messages_insert_own" on public.whatsapp_messages;
create policy "whatsapp_messages_insert_own"
on public.whatsapp_messages for insert
with check (auth.uid() = user_id);

drop policy if exists "whatsapp_messages_update_own" on public.whatsapp_messages;
create policy "whatsapp_messages_update_own"
on public.whatsapp_messages for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists idx_whatsapp_messages_user_instance_phone
on public.whatsapp_messages(user_id, instance, phone);

-- operational_data
alter table public.operational_data enable row level security;

drop policy if exists "operational_data_select_own" on public.operational_data;
create policy "operational_data_select_own"
on public.operational_data for select
using (auth.uid() = user_id);

drop policy if exists "operational_data_insert_own" on public.operational_data;
create policy "operational_data_insert_own"
on public.operational_data for insert
with check (auth.uid() = user_id);

drop policy if exists "operational_data_update_own" on public.operational_data;
create policy "operational_data_update_own"
on public.operational_data for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
