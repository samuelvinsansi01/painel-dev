-- V32 - unicidade fisica de leads por usuario + telefone normalizado.
-- Execute depois de confirmar que a consulta de diagnostico nao retorna linhas.

create or replace function public.normalize_lead_phone_v32(value text)
returns text
language sql
immutable
as $$
  select case
    when digits = '' then ''
    when digits !~ '^55' and length(digits) in (10, 11) then '55' || digits
    else digits
  end
  from (
    select regexp_replace(coalesce(value, ''), '\D', '', 'g') as digits
  ) normalized;
$$;

alter table if exists public.leads
  add column if not exists phone_normalized text;

update public.leads
set phone_normalized = public.normalize_lead_phone_v32(phone)
where phone_normalized is distinct from public.normalize_lead_phone_v32(phone);

-- Diagnostico: esta consulta deve retornar zero linhas antes de criar o indice.
select
  user_id,
  phone_normalized,
  count(*) as total,
  array_agg(id order by created_at asc nulls last) as lead_ids
from public.leads
where coalesce(phone_normalized, '') <> ''
group by user_id, phone_normalized
having count(*) > 1;

create unique index if not exists leads_user_phone_normalized_unique_v32
  on public.leads(user_id, phone_normalized)
  where coalesce(phone_normalized, '') <> '';

create or replace function public.set_lead_phone_normalized_v32()
returns trigger
language plpgsql
as $$
begin
  new.phone_normalized := public.normalize_lead_phone_v32(new.phone);
  return new;
end;
$$;

drop trigger if exists leads_phone_normalized_v32 on public.leads;
create trigger leads_phone_normalized_v32
before insert or update of phone
on public.leads
for each row
execute function public.set_lead_phone_normalized_v32();
