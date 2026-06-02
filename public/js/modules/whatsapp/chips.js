/* ════════════════════════════
   CHIPS V29 — DISTRIBUIÇÃO
════════════════════════════ */
const WHATSAPP_CHIPS_V29_KEY = 'vs_whatsapp_chips_v29';
const CHIP_USAGE_DAY_KEY = 'vs_chip_usage_day_v29';

/* V22 — isolamento multiusuário dos chips
   O localStorage é apenas cache por usuário. A fonte persistente é public.whatsapp_instances. */
function getCurrentUserIdV22(){
  try { return (typeof currentUser !== 'undefined' && currentUser?.id) ? String(currentUser.id) : ''; } catch { return ''; }
}

function scopedWhatsappChipsKeyV22(){
  const userId = getCurrentUserIdV22();
  return userId ? `${WHATSAPP_CHIPS_V29_KEY}:${userId}` : `${WHATSAPP_CHIPS_V29_KEY}:anonymous`;
}

function scopedChipUsageKeyV22(){
  const userId = getCurrentUserIdV22();
  return userId ? `${CHIP_USAGE_DAY_KEY}:${userId}` : `${CHIP_USAGE_DAY_KEY}:anonymous`;
}

function isSupabaseChipStoreReadyV22(){
  return !!(typeof sbClient !== 'undefined' && sbClient && getCurrentUserIdV22());
}

function normalizeChipRowToLocalV22(row = {}){
  return {
    id: String(row.chip_id || row.id || row.instance || `chip_${Date.now()}`),
    name: row.name || row.label || row.instance || 'WhatsApp',
    instance: row.instance || row.name || '',
    status: row.active === false ? 'disabled' : 'active',
    paused: false,
    dailyLimit: Number(row.daily_limit || row.dailyLimit || 120),
    intervalSeconds: Number(row.interval_seconds || row.intervalSeconds || 120),
    blockSize: Number(row.block_size || row.blockSize || 30),
    blocks: Array.isArray(row.blocks) ? row.blocks : ['08:00','10:00','12:00','14:00'],
    connectionState: row.status || row.connection_state || 'salvo no banco',
    phone: row.phone || row.number || '',
    dbId: row.id || null
  };
}

async function loadWhatsappChipsFromSupabaseV22(){
  if (!isSupabaseChipStoreReadyV22()) return [];
  const userId = getCurrentUserIdV22();
  try {
    const { data, error } = await sbClient
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending:false });

    if (error) throw error;

    const rows = (Array.isArray(data) ? data : []).filter(row => row.active !== false);
    const chips = rows.map(normalizeChipRowToLocalV22).filter(chip => chip.instance);

    localStorage.setItem(scopedWhatsappChipsKeyV22(), JSON.stringify(chips));
    // Remove cache legado global para impedir vazamento entre contas no mesmo navegador.
    localStorage.removeItem(WHATSAPP_CHIPS_V29_KEY);

    console.log('[chips][db-load]', { userId, count:chips.length });
    updateChipsBadge();
    return chips;
  } catch (err) {
    console.warn('[chips][db-load-error]', err?.message || err);
    return [];
  }
}

async function persistWhatsappChipsToSupabaseV22(list = []){
  if (!isSupabaseChipStoreReadyV22()) return;
  const userId = getCurrentUserIdV22();
  const chips = Array.isArray(list) ? list : [];
  try {
    const { data:existingRows, error:selectError } = await sbClient
      .from('whatsapp_instances')
      .select('id,chip_id')
      .eq('user_id', userId);
    if (selectError) throw selectError;

    const existingByChipId = new Map((existingRows || []).map(row => [String(row.chip_id || ''), row]));
    const activeIds = new Set(chips.map(chip => String(chip.id || chip.instance || '')).filter(Boolean));

    for (const chip of chips) {
      const chipId = String(chip.id || chip.instance || '').trim();
      if (!chipId) continue;
      const payload = {
        user_id: userId,
        chip_id: chipId,
        name: chip.name || chip.instance || 'WhatsApp',
        instance: chip.instance || chip.name || chipId,
        active: chip.status !== 'disabled'
      };

      const existing = existingByChipId.get(chipId);
      if (existing?.id) {
        const { error } = await sbClient.from('whatsapp_instances').update(payload).eq('id', existing.id).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await sbClient.from('whatsapp_instances').insert(payload);
        if (error) throw error;
      }
    }

    for (const row of existingRows || []) {
      const chipId = String(row.chip_id || '');
      if (chipId && !activeIds.has(chipId)) {
        const { error } = await sbClient.from('whatsapp_instances').update({ active:false }).eq('id', row.id).eq('user_id', userId);
        if (error) console.warn('[chips][db-deactivate-error]', error.message);
      }
    }

    console.log('[chips][db-save]', { userId, count:chips.length });
  } catch (err) {
    console.warn('[chips][db-save-error]', err?.message || err);
  }
}

window.loadWhatsappChipsFromSupabaseV22 = loadWhatsappChipsFromSupabaseV22;
window.persistWhatsappChipsToSupabaseV22 = persistWhatsappChipsToSupabaseV22;

function todayUsageKeyV29(){ return new Date().toISOString().slice(0,10); }

function getWhatsappChipsV29(){
  try {
    if (!getCurrentUserIdV22()) return [];
    const data = JSON.parse(localStorage.getItem(scopedWhatsappChipsKeyV22()) || '[]');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function saveWhatsappChipsV29(list){
  const safeList = Array.isArray(list) ? list : [];
  setTimeout(() => { try { scheduleOperationalSyncV36(); } catch(e){} }, 0);
  if (getCurrentUserIdV22()) {
    localStorage.setItem(scopedWhatsappChipsKeyV22(), JSON.stringify(safeList));
    localStorage.removeItem(WHATSAPP_CHIPS_V29_KEY);
    setTimeout(() => { try { persistWhatsappChipsToSupabaseV22(safeList); } catch(e){} }, 0);
  }
  updateChipsBadge();
}

function getChipUsageV29(){
  try {
    if (!getCurrentUserIdV22()) return { day: todayUsageKeyV29(), chips:{} };
    const usage = JSON.parse(localStorage.getItem(scopedChipUsageKeyV22()) || '{}');
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return { day: todayUsageKeyV29(), chips:{} };
    if (usage.day !== todayUsageKeyV29()) return { day: todayUsageKeyV29(), chips:{} };
    return usage;
  } catch { return { day: todayUsageKeyV29(), chips:{} }; }
}

function saveChipUsageV29(usage){
  if (!getCurrentUserIdV22()) return;
  localStorage.setItem(scopedChipUsageKeyV22(), JSON.stringify(usage));
}

function getChipUsedToday(chipId){
  const usage = getChipUsageV29();
  return Number(usage.chips?.[chipId] || 0);
}

function setChipUsedToday(chipId, count){
  const usage = getChipUsageV29();
  usage.chips = usage.chips || {};
  usage.chips[chipId] = Number(count || 0);
  saveChipUsageV29(usage);
}

function addWhatsappChip(){
  return saveChipWithConnectionTestV406();
}

function removeWhatsappChip(id){
  saveWhatsappChipsV29(getWhatsappChipsV29().filter(chip => chip.id !== id));
  renderChipsPanel();
}

function toggleChipPause(id){
  const chips = getWhatsappChipsV29();
  const chip = chips.find(c => c.id === id);
  if (!chip) return;
  chip.paused = !chip.paused;
  saveWhatsappChipsV29(chips);
  renderChipsPanel();
}

function toggleChipEnabled(id){
  const chips = getWhatsappChipsV29();
  const chip = chips.find(c => c.id === id);
  if (!chip) return;
  chip.status = chip.status === 'disabled' ? 'active' : 'disabled';
  saveWhatsappChipsV29(chips);
  renderChipsPanel();
}

function resetDailyChipUsage(){
  saveChipUsageV29({ day: todayUsageKeyV29(), chips:{} });
  renderChipsPanel();
  notify('Contadores do dia zerados.');
}

function getAvailableChipsV29(){
  return getWhatsappChipsV29().filter(chip => {
    if (chip.status === 'disabled' || chip.paused) return false;
    return getChipUsedToday(chip.id) < Number(chip.dailyLimit || 120);
  });
}

function assignChipsToReadyQueue(){
  const chips = getAvailableChipsV29();
  if (!chips.length) {
    notify('Nenhum chip disponível.', 'warn');
    return;
  }

  const queue = getWhatsappQueueV27 ? getWhatsappQueueV27() : [];
  const ready = queue.filter(item => item.status === 'Pronto' && !item.chipId);

  if (!ready.length) {
    notify('Nenhum lead pronto sem chip.', 'warn');
    return;
  }

  let assigned = 0;
  let chipIndex = 0;

  ready.forEach(item => {
    let tries = 0;
    let selected = null;

    while (tries < chips.length) {
      const chip = chips[chipIndex % chips.length];
      chipIndex++;
      tries++;

      const used = getChipUsedToday(chip.id);
      if (used < Number(chip.dailyLimit || 120)) {
        selected = chip;
        break;
      }
    }

    if (!selected) return;

    item.chipId = selected.id;
    item.chipName = selected.name;
    item.chipInstance = selected.instance;
    item.intervalSeconds = Number(selected.intervalSeconds || 120);
    item.blockSize = Number(selected.blockSize || 30);
    item.blocks = selected.blocks || ['08:00','10:00','12:00','14:00'];
    item.updatedAt = new Date().toISOString();

    setChipUsedToday(selected.id, getChipUsedToday(selected.id) + 1);
    assigned++;

    if (item.leadId && typeof addLeadHistory === 'function') {
      addLeadHistory(item.leadId, `Chip atribuído para disparo: ${selected.name}`, findLeadEverywhere(item.leadId) || {});
    }
  });

  saveWhatsappQueueV27(queue);
  renderChipsPanel();
  if (typeof renderWhatsappQueuePanel === 'function') renderWhatsappQueuePanel();
  notify(`${assigned} lead(s) receberam chip.`);
}

function renderChipsOperationSummary(){
  const box = document.getElementById('chipsOperationSummary');
  if (!box) return;

  const chips = getWhatsappChipsV29();
  const active = chips.filter(c => c.status !== 'disabled' && !c.paused);
  const totalCapacity = active.reduce((sum, chip) => sum + Math.max(0, Number(chip.dailyLimit || 120) - getChipUsedToday(chip.id)), 0);
  const totalDaily = chips.reduce((sum, chip) => sum + Number(chip.dailyLimit || 120), 0);

  box.innerHTML = `
    Chips cadastrados: ${chips.length}<br>
    Chips ativos: ${active.length}<br>
    Capacidade diária total: ${totalDaily}<br>
    Capacidade restante hoje: ${totalCapacity}<br>
    Padrão recomendado: 120 por chip · 4 blocos de 30 · 120s · espera 1h entre blocos
  `;
}

function renderChipsList(){
  const box = document.getElementById('chipsList');
  if (!box) return;

  const chips = getWhatsappChipsV29();

  if (!chips.length) {
    box.innerHTML = '<div class="queue-v27-empty">// nenhum chip cadastrado ainda</div>';
    return;
  }

  box.innerHTML = chips.map(chip => {
    const used = getChipUsedToday(chip.id);
    const limit = Number(chip.dailyLimit || 120);
    const pct = Math.min(100, Math.round((used / Math.max(limit,1)) * 100));
    const disabled = chip.status === 'disabled';
    const paused = !!chip.paused;
    const stateClass = disabled ? 'disabled' : paused ? 'paused' : '';
    const pill = disabled
      ? '<span class="chip-pill err">desativado</span>'
      : paused
        ? '<span class="chip-pill warn">pausado</span>'
        : '<span class="chip-pill ok">ativo</span>';

    return `
      <div class="chip-card ${stateClass}">
        <div class="chip-card-top">
          <div>
            <div class="chip-card-name">${escHtml(chip.name)}</div>
            <div class="chip-card-meta">
              URL: ${escHtml(chip.url || chip.baseUrl || chip.evolutionUrl || 'sem URL')}<br>Instância: ${escHtml(chip.instance)}<br>Estado: ${escHtml(chip.connectionState || 'não testado')}<br>
              Blocos: ${escHtml((chip.blocks || []).join(', '))}<br>
              Intervalo: ${escHtml(String(chip.intervalSeconds || 120))}s
            </div>
          </div>
          ${pill}
        </div>
        <div class="chip-card-meta">${used} / ${limit} envios hoje</div>
        <div class="chip-progress"><div class="chip-progress-fill" style="width:${pct}%"></div></div>
        <div class="chip-card-actions">
          <button class="btn btn-ghost" style="font-size:10px;padding:7px 12px" onclick="toggleChipPause('${escHtml(chip.id)}')">${paused ? 'Retomar' : 'Pausar'}</button>
          <button class="btn btn-ghost" style="font-size:10px;padding:7px 12px" onclick="toggleChipEnabled('${escHtml(chip.id)}')">${disabled ? 'Ativar' : 'Desativar'}</button>
          <button class="btn btn-danger" style="font-size:10px;padding:7px 12px" onclick="removeWhatsappChip('${escHtml(chip.id)}')">Remover</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderChipsPanel(){
  renderChipsOperationSummary();
  renderChipsList();
  updateChipsBadge();
}

function updateChipsBadge(){
  const badge = document.getElementById('badge-chips');
  if (badge) badge.textContent = getWhatsappChipsV29().length;
}


