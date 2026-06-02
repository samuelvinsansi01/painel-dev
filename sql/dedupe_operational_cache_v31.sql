-- V31: limpeza segura do snapshot operacional legado que estava regravando duplicatas.
-- Execute após subir o código V31.
-- Ele NÃO apaga leads, mensagens, notas ou histórico. Apenas faz backup e remove o cache operacional legado.

create table if not exists backup_operational_data_v31 as
select *
from operational_data
where false;

insert into backup_operational_data_v31
select *
from operational_data
where scope = 'crm_operational_v36';

-- Remove o snapshot legado. O sistema reconstruirá a tela a partir das tabelas/caches já deduplicados.
delete from operational_data
where scope = 'crm_operational_v36';

-- Diagnóstico opcional: duplicados reais na tabela leads por telefone normalizado.
select
  user_id,
  regexp_replace(coalesce(phone, whatsapp, telefone, ''), '\\D', '', 'g') as phone_norm,
  count(*) as total,
  array_agg(id order by created_at asc nulls last) as lead_ids,
  array_agg(coalesce(company_name, nome, title, '') order by created_at asc nulls last) as nomes
from leads
group by user_id, regexp_replace(coalesce(phone, whatsapp, telefone, ''), '\\D', '', 'g')
having regexp_replace(coalesce(phone, whatsapp, telefone, ''), '\\D', '', 'g') <> ''
   and count(*) > 1;
