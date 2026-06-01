/* ════════════════════════════
   PERSISTÊNCIA SUPABASE V36
════════════════════════════ */
const OPERATIONAL_SUPABASE_TABLE_V36 = 'operational_data';

const OPERATIONAL_DATA_KEYS_V36 = {
  leadCrm: 'vs_lead_crm_v1',
  weeklyLeads: EMPRESAS_KEY,
  weeklyHistory: HISTORY_KEY,
  monthlyTracking: ACOMP_KEY,
  validationQueue: VAL_KEY,
  assignmentQueue: ATRIBUICAO_KEY,
  instagramQueue: INSTA_KEY,
  instagramWeek: INSTA_WEEK_KEY,
  instagramSchedule: INSTA_SCHED_KEY,
  whatsappDispatchQueues: FILA_DISPARO_KEY,
  whatsappBacklog: 'vin_zap_backlog',
  legacyChips: CHIPS_KEY,
  legacyEvolutionSettings: EVO_KEY,
  excludedDomains: EXCLUDED_KEY,
  branches: RAMOS_KEY,
  legacyTemplates: TEMPLATES_KEY,
  branchTemplates: TEMPLATES_RAMO_KEY,
  whatsappQueue: 'vs_whatsapp_queue_v27',
  queueCampaigns: 'vs_queue_campaigns_v27',
  queueTemplates: 'vs_queue_templates_v27',
  whatsappChips: 'vs_whatsapp_chips_v29',
  chipUsage: 'vs_chip_usage_day_v29',
  queueControl: 'vs_whatsapp_queue_control_v28',
  dispatchLogs: 'vs_dispatch_v30_log',
  dispatchRuntime: 'vs_dispatch_runtime_v32',
  evolutionResponses: 'vs_evolution_responses_v34',
  evolutionSettings: 'vs_evolution_settings_v1'
};

function setPersistenceStatusV36(text, type = '') {
  const box = document.getElementById('persistenceV36Status');
  if (!box) return;
  box.classList.remove('ok','warn');
  if (type) box.classList.add(type);
  box.textContent = text;
}

function getOperationalSnapshotV36() {
  const data = {};
  Object.entries(OPERATIONAL_DATA_KEYS_V36).forEach(([name, key]) => {
    try {
      data[name] = JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      data[name] = localStorage.getItem(key);
    }
  });

  return {
    version: 'v36',
    exportedAt: new Date().toISOString(),
    data
  };
}

function restoreOperationalSnapshotV36(snapshot = {}) {
  const data = snapshot.data || {};
  Object.entries(OPERATIONAL_DATA_KEYS_V36).forEach(([name, key]) => {
    if (data[name] === undefined) return;
    localStorage.setItem(key, JSON.stringify(data[name]));
  });

  try { filaDisparo = JSON.parse(localStorage.getItem(FILA_DISPARO_KEY) || '{}') || {}; } catch {}
  if (typeof updateBadges === 'function') updateBadges();
  if (typeof updateWhatsappQueueBadge === 'function') updateWhatsappQueueBadge();
  if (typeof updateChipsBadge === 'function') updateChipsBadge();
  if (typeof updateResponsesBadgeV34 === 'function') updateResponsesBadgeV34();
  if (typeof updateAuditBadgeV35 === 'function') updateAuditBadgeV35();
  if (typeof renderInicio === 'function') renderInicio();
  if (document.getElementById('panel-fila-zap')?.classList.contains('active') && typeof renderFilaZap === 'function') renderFilaZap();
}

function isSupabaseOperationalReadyV36() {
  return !!(typeof sbClient !== 'undefined' && sbClient && currentUser?.id);
}

async function syncOperationalDataToSupabaseV36({ silent = false } = {}) {
  if (!isSupabaseOperationalReadyV36()) {
    setPersistenceStatusV36('Supabase indisponível ou usuário não conectado.', 'warn');
    if (!silent) notify('Entre na conta antes de sincronizar.', 'warn');
    return;
  }

  const snapshot = getOperationalSnapshotV36();

  setPersistenceStatusV36('Enviando dados operacionais para o Supabase...');

  try {
    const payload = {
      user_id: currentUser.id,
      scope: 'crm_operational_v36',
      payload: snapshot,
      updated_at: new Date().toISOString()
    };

    const { error } = await sbClient
      .from(OPERATIONAL_SUPABASE_TABLE_V36)
      .upsert(payload, { onConflict: 'user_id,scope' });

    if (error) throw error;

    setPersistenceStatusV36('Dados operacionais sincronizados com sucesso.', 'ok');
    if (!silent) notify('Dados operacionais enviados ao Supabase.');
  } catch (err) {
    setPersistenceStatusV36(
      'Falha ao sincronizar. Verifique se a tabela operational_data existe.\n\n' +
      'Erro: ' + (err?.message || 'erro desconhecido'),
      'warn'
    );
  }
}

async function loadOperationalDataFromSupabaseV36() {
  if (!isSupabaseOperationalReadyV36()) {
    setPersistenceStatusV36('Supabase indisponível ou usuário não conectado.', 'warn');
    notify('Entre na conta antes de carregar.', 'warn');
    return false;
  }

  setPersistenceStatusV36('Carregando dados operacionais do Supabase...');

  try {
    const { data, error } = await sbClient
      .from(OPERATIONAL_SUPABASE_TABLE_V36)
      .select('payload,updated_at')
      .eq('user_id', currentUser.id)
      .eq('scope', 'crm_operational_v36')
      .maybeSingle();

    if (error) throw error;

    if (!data?.payload) {
      setPersistenceStatusV36('Nenhum dado operacional encontrado no Supabase.', 'warn');
      return false;
    }

    restoreOperationalSnapshotV36(data.payload);
    setPersistenceStatusV36('Dados carregados do Supabase e aplicados no CRM.', 'ok');
    notify('Dados operacionais carregados.');
    const restoredData = data.payload?.data || {};
    return Object.prototype.hasOwnProperty.call(restoredData, 'weeklyLeads')
      || Object.prototype.hasOwnProperty.call(restoredData, 'validationQueue')
      || Object.prototype.hasOwnProperty.call(restoredData, 'assignmentQueue')
      || Object.prototype.hasOwnProperty.call(restoredData, 'whatsappDispatchQueues');
  } catch (err) {
    setPersistenceStatusV36(
      'Falha ao carregar. Verifique se a tabela operational_data existe.\n\n' +
      'Erro: ' + (err?.message || 'erro desconhecido'),
      'warn'
    );
    return false;
  }
}

function showPersistenceSchemaV36() {
  const sql = `
create table if not exists public.operational_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scope text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, scope)
);

alter table public.operational_data enable row level security;

create policy "operational_data_select_own"
on public.operational_data for select
using (auth.uid() = user_id);

create policy "operational_data_insert_own"
on public.operational_data for insert
with check (auth.uid() = user_id);

create policy "operational_data_update_own"
on public.operational_data for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
`;

  setPersistenceStatusV36(sql, 'warn');
  navigator.clipboard?.writeText(sql);
  notify('SQL das tabelas copiado.');
}

function scheduleOperationalSyncV36() {
  if (!isSupabaseOperationalReadyV36()) return;
  clearTimeout(window.__operationalSyncV36Timer);
  window.__operationalSyncV36Timer = setTimeout(() => {
    syncOperationalDataToSupabaseV36({ silent: true });
  }, 1500);
}

function scheduleLegacyOperationalSyncV36() {
  if (typeof scheduleOperationalSyncV36 === 'function') scheduleOperationalSyncV36();
}


