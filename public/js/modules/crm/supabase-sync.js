/* ════════════════════════════
   SUPABASE PRIMARY V15
════════════════════════════ */
const SYNC_STATE_KEY = 'vs_supabase_sync_state_v1';
function getSyncStateKeyV423(){
  try { return currentUser?.id ? `${SYNC_STATE_KEY}:${currentUser.id}` : `${SYNC_STATE_KEY}:anonymous`; } catch(e) { return `${SYNC_STATE_KEY}:anonymous`; }
}

function getSyncState() {
  try {
    const state = JSON.parse(localStorage.getItem(getSyncStateKeyV423()) || '{}' );
    return state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  } catch {
    return {};
  }
}

function setSyncState(data = {}) {
  const prev = getSyncState();
  localStorage.setItem(getSyncStateKeyV423(), JSON.stringify({
    ...prev,
    ...data,
    updatedAt: new Date().toISOString()
  }));
  renderSyncStatus();
}

function isSupabaseReady() {
  return !!(sbClient && currentUser?.id && currentUser?.email);
}

function renderSyncStatus() {
  const box = document.getElementById('authSyncStatus');
  if (!box) return;

  if (!currentUser) {
    box.className = 'sync-status warn';
    box.textContent = 'offline';
    return;
  }

  const state = getSyncState();
  const label = state.lastLoadedAt
    ? 'sincronizado'
    : 'conectado';

  box.className = 'sync-status ok';
  box.textContent = label;
}

async function upsertLeadToSupabase(lead = {}) {
  if (!isSupabaseReady() || !lead.id) return { skipped: true, reason:'auth-or-lead-missing' };
  try { requireCurrentAuthIdentityV25('upsertLeadToSupabase'); } catch(error) { return { skipped:true, error }; }
  uiSyncLogV426('supabase-save-start', { entity:'lead', id:lead.id });

  const payload = {
    id: lead.id,
    user_id: currentUser.id,
    company_name: lead.nome || lead.companyName || lead.title || 'Lead sem nome',
    phone: lead.whatsapp || lead.phone || lead.telefone || '',
    instagram: lead.instagram || lead.instagramUrl || '',
    website: lead.site || lead.website || '',
    maps_url: lead.googleUrl || lead.mapsUrl || lead.url || '',
    status: lead.status || 'Não enviada',
    pipeline_status: lead.pipelineStatus || 'contato_enviado',
    updated_at: new Date().toISOString()
  };

  const { error } = await sbClient.from('leads').upsert(payload);
  if (error) {
    uiSyncLogV426('supabase-save-error', { entity:'lead', id:lead.id, error:error.message });
    console.warn('[supabase] upsert lead:', error.message);
    setSyncState({ lastError: error.message });
    return { error };
  }

  uiSyncLogV426('supabase-save-success', { entity:'lead', id:lead.id });
  return { ok: true };
}

async function syncAllLocalLeadsToSupabase() {
  if (!isSupabaseReady()) return;

  const permanentLeads = typeof reconcilePermanentLeadBase === 'function'
    ? reconcilePermanentLeadBase({ schedule:false })
    : (typeof getLeadBaseData === 'function' ? getLeadBaseData() : []);
  const data = ensureWeekData();
  const weekLeads = Object.values(data.days || {}).flat();

  const extras = [];
  try { extras.push(...getAtribuicaoData()); } catch {}
  try { extras.push(...getValData()); } catch {}
  try { extras.push(...getInstaFila()); } catch {}
  try { extras.push(...getZapBacklog()); } catch {}

  const all = [...permanentLeads, ...weekLeads, ...extras];
  const unique = new Map();
  all.forEach(lead => {
    if (lead?.id) unique.set(lead.id, lead);
  });

  let ok = 0;
  for (const lead of unique.values()) {
    const result = await upsertLeadToSupabase(lead);
    if (result?.ok) ok++;
  }

  setSyncState({
    lastPushedAt: new Date().toISOString(),
    lastPushedCount: ok
  });

  console.log(`[supabase] Leads locais enviados: ${ok}`);
}

async function loadSupabaseAsPrimarySource(options = {}) {
  if (!isSupabaseReady()) return;

  await loadSupabaseLeadsToLocalState(options);

  syncAllLocalLeadsToSupabase().catch(error => {
    console.warn('[supabase] reconciliação de leads em segundo plano:', error?.message || error);
  });
  if (typeof scheduleOperationalSyncV36 === 'function') scheduleOperationalSyncV36();

  setSyncState({
    lastLoadedAt: new Date().toISOString()
  });

  renderSyncStatus();
}

