-- Mapeamento seguro de identificadores WhatsApp LID para leads/telefones reais.
-- Rode uma vez no Supabase SQL Editor antes de usar o botão "Associar ao lead".

create table if not exists public.whatsapp_contact_map (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  instance text not null,
  lead_id text not null,
  phone_real text,
  lid text not null,
  push_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists whatsapp_contact_map_user_instance_lid_idx
  on public.whatsapp_contact_map (user_id, instance, lid);

create index if not exists whatsapp_contact_map_lead_id_idx
  on public.whatsapp_contact_map (lead_id);
