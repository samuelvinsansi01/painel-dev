/* ════════════════════════════
   CHIPS V29 — DISTRIBUIÇÃO
════════════════════════════ */
const WHATSAPP_CHIPS_V29_KEY = 'vs_whatsapp_chips_v29';
const CHIP_USAGE_DAY_KEY = 'vs_chip_usage_day_v29';

function todayUsageKeyV29(){ return new Date().toISOString().slice(0,10); }

function getWhatsappChipsV29(){
  try {
    const data = JSON.parse(localStorage.getItem(WHATSAPP_CHIPS_V29_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function mapWhatsappInstanceRowToChipV414(row = {}, cached = null){
  const instance = row.instance || cached?.instance || '';
  const chipId = row.chip_id || cached?.chip_id || cached?.id || instance || ('chip_' + Date.now());
  return {
    ...(cached || {}),
    id: chipId,
    chip_id: chipId,
    name: row.name || cached?.name || cached?.nome || instance || 'WhatsApp',
    nome: row.name || cached?.nome || cached?.name || instance || 'WhatsApp',
    instance,
    phone: row.phone || cached?.phone || '',
    status: row.active === false ? 'disabled' : (cached?.status || 'active'),
    paused: cached?.paused || false,
    dailyLimit: Number(cached?.dailyLimit || 120),
    blockSize: Number(cached?.blockSize || 30),
    intervalSeconds: Number(cached?.intervalSeconds || 120),
    blocks: cached?.blocks || ['08:00','10:00','12:00','14:00'],
    connectionState: row.active === false ? 'disabled' : (cached?.connectionState || 'open'),
    createdAt: cached?.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dbId: row.id || cached?.dbId || null
  };
}

function isWhatsappInstancesDbReadyV414(){
  return !!(typeof sbClient !== 'undefined' && sbClient && currentUser?.id);
}

async function loadWhatsappInstancesFromSupabaseV414({ render = true } = {}){
  if (!isWhatsappInstancesDbReadyV414()) return [];
  try {
    const { data, error } = await sbClient
      .from('whatsapp_instances')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending:true });

    if (error) throw error;

    const cached = getWhatsappChipsV29();
    const rows = Array.isArray(data) ? data : [];
    const mapped = rows.map(row => {
      const match = cached.find(c => c.dbId === row.id || c.chip_id === row.chip_id || c.id === row.chip_id || c.instance === row.instance);
      return mapWhatsappInstanceRowToChipV414(row, match);
    });

    localStorage.setItem(WHATSAPP_CHIPS_V29_KEY, JSON.stringify(mapped));
    console.log('[chips][db] loaded whatsapp_instances:', mapped.length);

    if (render) {
      try { updateChipsBadge(); } catch(e){}
      try { renderChipsPanel(); } catch(e){}
      try { updateBadges(); } catch(e){}
    }

    return mapped;
  } catch(err) {
    console.warn('[chips][db] erro ao carregar whatsapp_instances:', err?.message || err);
    return getWhatsappChipsV29();
  }
}

async function persistWhatsappChipToSupabaseV414(chip = {}){
  if (!isWhatsappInstancesDbReadyV414() || !chip?.instance) return { ok:false, skipped:true };

  const chipId = String(chip.chip_id || chip.id || chip.instance || '').trim();
  const payload = {
    user_id: currentUser.id,
    chip_id: chipId,
    name: chip.name || chip.nome || chip.instance || 'WhatsApp',
    instance: chip.instance,
    active: chip.status !== 'disabled' && !chip.paused
  };

  try {
    const { data: existing, error: findError } = await sbClient
      .from('whatsapp_instances')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('instance', chip.instance)
      .maybeSingle();

    if (findError) throw findError;

    const query = existing?.id
      ? sbClient.from('whatsapp_instances').update(payload).eq('id', existing.id)
      : sbClient.from('whatsapp_instances').insert(payload);

    const { error } = await query;
    if (error) throw error;

    console.log('[chips][db] saved whatsapp_instance:', payload);
    return { ok:true };
  } catch(err) {
    console.warn('[chips][db] erro ao salvar whatsapp_instance:', err?.message || err, payload);
    return { ok:false, error:err };
  }
}

async function persistWhatsappChipsToSupabaseV414(list = []){
  if (!isWhatsappInstancesDbReadyV414()) return;
  const chips = Array.isArray(list) ? list : [];
  for (const chip of chips) {
    await persistWhatsappChipToSupabaseV414(chip);
  }
}

async function deleteWhatsappChipFromSupabaseV414(chip = {}){
  if (!isWhatsappInstancesDbReadyV414()) return;
  const instance = chip?.instance;
  const chipId = chip?.chip_id || chip?.id;
  try {
    let query = sbClient.from('whatsapp_instances').delete().eq('user_id', currentUser.id);
    if (instance) query = query.eq('instance', instance);
    else if (chipId) query = query.eq('chip_id', chipId);
    else return;
    const { error } = await query;
    if (error) throw error;
    console.log('[chips][db] removed whatsapp_instance:', instance || chipId);
  } catch(err) {
    console.warn('[chips][db] erro ao remover whatsapp_instance:', err?.message || err);
  }
}

function saveWhatsappChipsV29(list){
  setTimeout(() => { try { scheduleOperationalSyncV36(); } catch(e){} }, 0);
  localStorage.setItem(WHATSAPP_CHIPS_V29_KEY, JSON.stringify(list || []));
  updateChipsBadge();
  setTimeout(() => { try { persistWhatsappChipsToSupabaseV414(list || []); } catch(e){} }, 0);
}

function getChipUsageV29(){
  try {
    const usage = JSON.parse(localStorage.getItem(CHIP_USAGE_DAY_KEY) || '{}');
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return { day: todayUsageKeyV29(), chips:{} };
    if (usage.day !== todayUsageKeyV29()) return { day: todayUsageKeyV29(), chips:{} };
    return usage;
  } catch { return { day: todayUsageKeyV29(), chips:{} }; }
}

function saveChipUsageV29(usage){
  localStorage.setItem(CHIP_USAGE_DAY_KEY, JSON.stringify(usage));
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
  const chips = getWhatsappChipsV29();
  const removed = chips.find(chip => chip.id === id || chip.chip_id === id);
  saveWhatsappChipsV29(chips.filter(chip => chip.id !== id && chip.chip_id !== id));
  setTimeout(() => { try { deleteWhatsappChipFromSupabaseV414(removed); } catch(e){} }, 0);
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


