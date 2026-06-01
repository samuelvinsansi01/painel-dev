/* ════════════════════════════
   SUPABASE PRIMARY V15
════════════════════════════ */
const SYNC_STATE_KEY = 'vs_supabase_sync_state_v1';

function getSyncState() {
  try {
    const state = JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || '{}');
    return state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  } catch {
    return {};
  }
}

function setSyncState(data = {}) {
  const prev = getSyncState();
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify({
    ...prev,
    ...data,
    updatedAt: new Date().toISOString()
  }));
  renderSyncStatus();
}

function isSupabaseReady() {
  return !!(sbClient && currentUser);
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
  if (!isSupabaseReady() || !lead.id) return { skipped: true };

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
    console.warn('[supabase] upsert lead:', error.message);
    setSyncState({ lastError: error.message });
    return { error };
  }

  return { ok: true };
}

async function syncAllLocalLeadsToSupabase() {
  if (!isSupabaseReady()) return;

  const data = ensureWeekData();
  const weekLeads = Object.values(data.days || {}).flat();

  const extras = [];
  try { extras.push(...getAtribuicaoData()); } catch {}
  try { extras.push(...getValData()); } catch {}
  try { extras.push(...getInstaFila()); } catch {}
  try { extras.push(...getZapBacklog()); } catch {}

  const all = [...weekLeads, ...extras];
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

  if (typeof loadSupabaseLeadCrmToLocalState === 'function') {
    await loadSupabaseLeadCrmToLocalState();
  }

  setSyncState({
    lastLoadedAt: new Date().toISOString()
  });

  renderSyncStatus();
}



