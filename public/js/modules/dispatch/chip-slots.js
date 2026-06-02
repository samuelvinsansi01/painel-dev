
function debugDispatchPersistV413(step, data = {}) {
  try {
    console.groupCollapsed(`[dispatch][persist] ${step}`);
    console.log(data);
    console.groupEnd();
  } catch (e) {
    console.log(`[dispatch][persist] ${step}`, data);
  }
}
/* ─── Per-chip state (indexed 0 = Chip1, 1 = Chip2) ─── */
const chipSlotState = [
  { filaLotes:[], loteAtual:0, lotesTotal:0, aguardandoLote:false, disparoEmAndamento:false, loteEsperaFim:null, loteEsperaTimer:null, loteCountdownInt:null, loteHistorico:[], retryItems:[], retryDisparado:false, ultimoLoteFimTs:null, pausado:false },
  { filaLotes:[], loteAtual:0, lotesTotal:0, aguardandoLote:false, disparoEmAndamento:false, loteEsperaFim:null, loteEsperaTimer:null, loteCountdownInt:null, loteHistorico:[], retryItems:[], retryDisparado:false, ultimoLoteFimTs:null, pausado:false }
];

/* Limite diario = 180 por chip. */
function getDailyLimit() { return Math.max(1, getChips().length) * WHATSAPP_CHIP_DAILY_LIMIT_V426; }

/* ─── Helpers por slot ─── */
function getChipBySlot(slot) { return getChips()[slot] || null; }

function toggleFilaItemSlot(slot, id) {
  const chip = getChipBySlot(slot); if (!chip) return;
  const fila = getFilaChip(chip.id);
  const item = fila.find(f => f.id === id);
  if (!item) return;
  item.aberto = !item.aberto;
  renderFilaSlot(slot, disparoDay);
}

function atualizarMsgFilaSlot(slot, id, val) {
  const chip = getChipBySlot(slot); if (!chip) return;
  const fila = getFilaChip(chip.id);
  const item = fila.find(f => f.id === id);
  if (item) { item.mensagem = val; saveFilaDisparo(); }
}

function removerFilaSlot(slot, id) {
  const chip = getChipBySlot(slot); if (!chip) return;
  const fila = getFilaChip(chip.id);
  const item = fila.find(f => f.id === id);
  abrirModalConfirm(
    `Remover <strong>${item ? escHtml(item.nome) : 'esta empresa'}</strong> da fila?`,
    () => {
      const f2 = getFilaChip(chip.id).filter(f => f.id !== id);
      filaDisparo[chip.id] = f2;
      const data = ensureWeekData();
      Object.keys(data.days).forEach(day => {
        const emp = (data.days[day]||[]).find(e => e.id === id);
        if (emp && emp.status === 'Em fila') emp.status = 'Não enviada';
      });
      saveWeekData(data); saveFilaDisparo({ delay:0, reason:'dispatch-chip-assignment-remove' }); updateBadges();
      renderDisparoEmpresas(); renderFilaSlot(slot, disparoDay);
    }
  );
}

function limparFilaChip(slot) {
  const st = chipSlotState[slot];
  if (st.disparoEmAndamento || st.aguardandoLote) { notify('// disparo em andamento','warn'); return; }
  const chip = getChipBySlot(slot); if (!chip) return;
  const fila = getFilaChip(chip.id);
  const data = ensureWeekData();
  fila.forEach(f => {
    Object.keys(data.days).forEach(day => {
      const emp = (data.days[day]||[]).find(e => e.id === f.id);
      if (emp && emp.status === 'Em fila') emp.status = 'Não enviada';
    });
  });
  saveWeekData(data);
  filaDisparo[chip.id] = [];
  st.loteHistorico = [];
  st.retryItems = [];
  st.retryDisparado = false;
  st.ultimoLoteFimTs = null;
  saveFilaDisparo({ delay:0, reason:'dispatch-chip-queue-clear' });
  updateBadges(); renderDisparoEmpresas(); renderFilaSlot(slot, disparoDay);
}

/* ─── Iniciar disparo por slot ─── */
async function iniciarDisparoChip(slot) {
  const devolvidos = devolverZapNaoValidadoParaValidacao();
  if (devolvidos) {
    notify(`↩ ${devolvidos} lead(s) sem WhatsApp validado voltaram para Validação`, 'warn');
    renderFilaZap();
    return;
  }
  const st = chipSlotState[slot];
  if (st.disparoEmAndamento || st.aguardandoLote) return;
  const chip = getChipBySlot(slot);
  if (!chip) { notify('// chip ' + (slot+1) + ' não configurado','err'); return; }
  const fila = getFilaChip(chip.id).filter(f => f.status !== 'enviado');
  if (!fila.length) { notify('// fila vazia','warn'); return; }

  // Congela o lote — snapshot dos itens aguardando
  const LOTE_SIZE = getLoteSize();
  const filaCompleta = getFilaChip(chip.id);
  const pendentes = filaCompleta.filter(f => f.status === 'aguardando');
  if (!pendentes.length) { notify('// nenhum item aguardando — todos já enviados','warn'); return; }

  // ── Validação: todos os lotes com pendentes devem ter imagem ──
  // Itera apenas sobre itens aguardando, que é como os lotes são
  // numerados visualmente e como as imagens são salvas pelo usuário
  const lotesComPendentes = [];
  for (let i = 0; i < pendentes.length; i += LOTE_SIZE) {
    const loteNum = Math.floor(i / LOTE_SIZE) + 1;
    lotesComPendentes.push(loteNum);
  }

  // Garante que o cache está populado para cada lote antes de validar
  await Promise.all(lotesComPendentes.map(async loteNum => {
    const k = getLoteImgKey(chip.id, loteNum);
    if (_imgCache[k] === undefined) {
      try { _imgCache[k] = (await idbGet(k)) || null; } catch { _imgCache[k] = null; }
    }
  }));

  const lotesSemImagem = lotesComPendentes.filter(n => !getLoteImagem(chip.id, n));
  if (lotesSemImagem.length) {
    notify(`// Lote${lotesSemImagem.length>1?'s':''} ${lotesSemImagem.join(', ')} sem imagem — insira a imagem antes de disparar`, 'err');
    return;
  }

  st.filaLotes = [];
  st.loteAtual = 0;
  st.loteHistorico = st.loteHistorico || [];
  for (let i = 0; i < pendentes.length; i += LOTE_SIZE) {
    st.filaLotes.push(pendentes.slice(i, i + LOTE_SIZE));
  }
  st.lotesTotal = st.filaLotes.length;
  const logEl = document.getElementById(`disparoLog${slot}`);
  if (logEl) { logEl.innerHTML = ''; logEl.style.display = 'block'; }
  await dispararLoteChip(slot);
}

/* ─── Disparo de um lote por slot ─── */
async function dispararLoteChip(slot) {
  const st = chipSlotState[slot];
  const chip = getChipBySlot(slot);
  if (!chip) return;
  st.loteAtual++;
  const lote = st.filaLotes.shift();
  const esperaMin = Math.max(60, parseInt(document.getElementById('loteEsperaMin')?.value)||60);
  const delayMin  = parseInt(document.getElementById('delayMin')?.value)||120;
  const delayMax  = parseInt(document.getElementById('delayMax')?.value)||180;
  const MSG_DELAY = 15000;
  const chipCor   = slot === 0 ? 'var(--accent)' : '#5bb8f5';

  st.disparoEmAndamento = true;
  const btnEl  = document.getElementById(`btnDisparar${slot}`);
  const spinEl = document.getElementById(`spinner${slot}`);
  const btnTxt = document.getElementById(`disparoBtn${slot}`);
  if (btnEl)  btnEl.disabled = true;
  if (spinEl) spinEl.style.display = 'block';
  if (btnTxt) btnTxt.textContent = `Lote ${st.loteAtual}/${st.lotesTotal}...`;
  _atualizarBotaoPausa(slot);

  const logEl = document.getElementById(`disparoLog${slot}`);
  if (logEl) logEl.style.display = 'block';
  function log(msg) {
    if (!logEl) return;
    const l = document.createElement('div');
    l.style.marginBottom = '3px';
    l.innerHTML = `<span style="color:var(--muted)">[${timeStr()}]</span> ${msg}`;
    logEl.appendChild(l); logEl.scrollTop = logEl.scrollHeight;
  }
  log(`<span style="color:${chipCor}">━━ LOTE ${st.loteAtual}/${st.lotesTotal} · ${lote.length} empresa${lote.length>1?'s':''} ━━</span>`);

  // Atualiza status visual de cada item do lote
  const loteSnapshot = lote.map(i => ({ ...i }));

  for (let i = 0; i < lote.length; i++) {
    const item = lote[i];
    if (item.status === 'enviado') continue;

    // ── Verificar pausa ──
    if (st.pausado) {
      log(`<span style="color:var(--warning)">⏸ Pausado após ${i} envio${i!==1?'s':''} — aguardando retomada...</span>`);
      const btnTxtP = document.getElementById(`disparoBtn${slot}`);
      if (btnTxtP) btnTxtP.textContent = `⏸ Pausado (${i}/${lote.length})`;
      while (st.pausado) {
        await new Promise(r => setTimeout(r, 500));
      }
      log(`<span style="color:var(--ok)">▶ Retomado</span>`);
      if (btnTxtP) btnTxtP.textContent = `Lote ${st.loteAtual}/${st.lotesTotal}...`;
    }

    item.status = 'enviando';
    atualizarStatusFilaSlot(slot, item.id, 'enviando');
    log(`Enviando para <span style="color:var(--text)">${escHtml(item.nome)}</span>...`);
    try {
      const waNum  = item.whatsapp.replace(/\D/g,'');
      const numero = waNum.startsWith('55') ? waNum : '55' + waNum;

      // MSG 1 — Apresentação
      const payload1 = { number: numero, options: { delay: 1000 }, textMessage: { text: item.mensagem } };
      const res1 = await fetch(`${chip.url}/message/sendText/${chip.instance}`, { method:'POST', headers:{'Content-Type':'application/json','apikey':chip.key}, body: JSON.stringify(payload1) });
      const data1 = await res1.json().catch(() => ({}));
      if (!res1.ok) throw new Error((data1 && (data1.message || data1.error)) || `HTTP ${res1.status}`);
      log(`  ① apresentação enviada`);

      // Persistir o envio inicial no histórico de conversas somente após sucesso na Evolution.
      debugDispatchPersistV413('persist-function-check', { file: 'chip-slots.js', available: typeof persistOutgoingWhatsappMessageV412 === 'function' });
      if (typeof persistOutgoingWhatsappMessageV412 === 'function') {
        const persistence = await persistOutgoingWhatsappMessageV412({
          id: typeof getEvolutionWhatsappExternalIdV412 === 'function'
            ? getEvolutionWhatsappExternalIdV412(data1, item.id)
            : '',
          leadId: item.leadId || item.id || '',
          instance: chip.instance,
          phone: numero,
          text: item.mensagem || '',
          occurredAt: new Date().toISOString(),
          response: data1
        }, { queueOnFailure: true });
        if (persistence?.ok) log(`  ↳ conversa salva no banco`);
        else log(`  ↳ <span style="color:var(--warning)">conversa pendente de sincronização</span>`);
      }
      await new Promise(r => setTimeout(r, MSG_DELAY));

      // MSG 2 — Imagem do lote
      const loteNum = st.loteAtual;
      const imgRedesign = getLoteImagem(chip.id, loteNum);
      if (imgRedesign) {
        await new Promise(r => setTimeout(r, MSG_DELAY));
        const b2 = imgRedesign.split(',')[1], m2 = imgRedesign.split(';')[0].split(':')[1] || 'image/jpeg';
        const payload3 = { number: numero, options: { delay: 1000 }, mediaMessage: { mediatype: 'image', media: b2, mimetype: m2, caption: '' } };
        await fetch(`${chip.url}/message/sendMedia/${chip.instance}`, { method:'POST', headers:{'Content-Type':'application/json','apikey':chip.key}, body: JSON.stringify(payload3) });
        log(`  ② imagem enviada`);
      }

      item.status = 'enviado';
      atualizarStatusFilaSlot(slot, item.id, 'enviado');
      atualizarStatusEmpresa(item.id, 'Enviada');
      log(`<span style="color:${chipCor}">✓ ${escHtml(item.nome)}</span>`);
    } catch(e) {
      item.status = 'erro';
      atualizarStatusFilaSlot(slot, item.id, 'erro');
      log(`<span style="color:var(--error)">✗ Erro — ${e.message}</span>`);
    }
    if (i < lote.length - 1) {
      const delay = (delayMin + Math.random()*(delayMax-delayMin))*1000;
      log(`Aguardando ${Math.round(delay/1000)}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Finalizar lote: mover enviados para histórico compacto, manter erros na fila
  const env   = lote.filter(f => f.status === 'enviado').length;
  const erros = lote.filter(f => f.status === 'erro').length;
  log(`<span style="color:${chipCor}">✓ Lote ${st.loteAtual} concluído! ${env} enviado${env>1?'s':''} · ${erros} erro${erros>1?'s':''}</span>`);

  // Adiciona lote ao histórico
  st.loteHistorico.push({
    num: st.loteAtual,
    total: st.lotesTotal,
    items: lote.map(f => ({ id: f.id, nome: f.nome, whatsapp: f.whatsapp, status: f.status })),
    env, erros,
    fimTs: Date.now()
  });

  // Remove enviados da fila ativa (mantém erros para retry)
  const enviados = lote.filter(f => f.status === 'enviado').map(f => f.id);
  if (enviados.length) {
    filaDisparo[chip.id] = filaDisparo[chip.id].filter(f => !enviados.includes(f.id));
    saveFilaDisparo({ delay:0, reason:'dispatch-chip-sent-items-remove' });
  }

  st.ultimoLoteFimTs = Date.now();
  st.disparoEmAndamento = false;
  if (spinEl) spinEl.style.display = 'none';
  renderFilaSlot(slot, disparoDay);
  renderInicio();

  if (st.filaLotes.length > 0) {
    // Ainda tem lotes — aguardar delay
    const esperaMs = esperaMin * 60 * 1000;
    st.loteEsperaFim = Date.now() + esperaMs;
    st.aguardandoLote = true;
    if (btnEl)  btnEl.disabled = true;
    if (btnTxt) btnTxt.textContent = `🟡 Aguardando lote ${st.loteAtual+1}/${st.lotesTotal}`;
    const panel = document.getElementById(`loteEsperaPanel${slot}`);
    if (panel) panel.style.display = 'block';
    const titleEl = document.getElementById(`loteEsperaTitle${slot}`);
    if (titleEl) titleEl.textContent = `⏱ Aguardando lote ${st.loteAtual+1}/${st.lotesTotal}...`;
    const proxBtn = document.getElementById(`btnProximoLote${slot}`);
    if (proxBtn) { proxBtn.disabled = true; proxBtn.style.background = 'var(--surface3)'; }
    const barEl = document.getElementById(`loteProgressBar${slot}`);
    if (barEl) barEl.style.width = '0%';
    notify(`✓ Lote ${st.loteAtual} concluído · próximo em ${esperaMin}min`);
    iniciarCountdownLoteChip(slot, esperaMs);
    _atualizarBotaoPausa(slot);
  } else {
    // Todos os lotes concluídos
    st.aguardandoLote = false;
    st.pausado = false;
    if (btnEl)  btnEl.disabled = false;
    if (btnTxt) btnTxt.textContent = slot === 0 ? '🟢 Disparar' : '🔵 Disparar';
    _atualizarBotaoPausa(slot);

    // Coletar erros para retry
    const erroItems = getFilaChip(chip.id).filter(f => f.status === 'erro');
    if (erroItems.length && !st.retryDisparado) {
      st.retryItems = erroItems;
      // Calcular horário sugerido: ultimoLoteFimTs + esperaMin + 30min de margem
      const retryTs = st.ultimoLoteFimTs + (esperaMin + 30) * 60 * 1000;
      const retryDate = new Date(retryTs);
      const hh = String(retryDate.getHours()).padStart(2,'0');
      const mm = String(retryDate.getMinutes()).padStart(2,'0');
      const horarioSugerido = `${hh}:${mm}`;
      // Exibir painel de retry
      exibirRetryPanel(slot, erroItems.length, horarioSugerido);
      notify(`⚠ ${erroItems.length} erro${erroItems.length>1?'s':''} — Lote Retry disponível`, 'warn');
    } else {
      const totalEnv = st.loteHistorico.reduce((s,l)=>s+l.env,0);
      const totalErr = st.loteHistorico.reduce((s,l)=>s+l.erros,0);
      notify(`✓ ${st.lotesTotal} lote${st.lotesTotal>1?'s':''} concluído${st.lotesTotal>1?'s':''} · ${totalEnv} enviados · ${totalErr} erros`);
    }
  }
}

function exibirRetryPanel(slot, count, horario) {
  const itensEl = document.getElementById(`filaItens${slot}`);
  if (!itensEl) return;
  const cor = 'var(--warning)';
  const retryHtml = `<div id="retryPanel${slot}" style="margin:8px 0;padding:12px 14px;border-radius:10px;background:rgba(240,164,41,0.06);border:1px solid rgba(240,164,41,0.3)">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <div style="flex:1">
        <div style="font-family:'DM Mono',monospace;font-size:9px;font-weight:700;letter-spacing:0.1em;color:var(--warning);margin-bottom:3px">⚠ LOTE RETRY — ${count} empresa${count>1?'s':''} com erro</div>
        <div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted)">Horário sugerido: <span style="color:var(--text2)">${horario}</span> · disparo manual</div>
      </div>
      <button onclick="iniciarRetryChip(${slot})" style="background:var(--warning);color:#0a0a0d;border:none;border-radius:7px;font-family:'Syne',sans-serif;font-weight:700;font-size:10px;padding:7px 14px;cursor:pointer;white-space:nowrap">↻ Disparar Retry</button>
    </div>
  </div>`;
  // Inserir antes dos itens da fila
  const existing = document.getElementById(`retryPanel${slot}`);
  if (existing) existing.outerHTML = retryHtml;
  else itensEl.insertAdjacentHTML('beforebegin', retryHtml);
}

async function iniciarRetryChip(slot) {
  const st = chipSlotState[slot];
  if (st.disparoEmAndamento || st.aguardandoLote) return;
  if (!st.retryItems || !st.retryItems.length) { notify('// nenhum item para retry','warn'); return; }
  const chip = getChipBySlot(slot); if (!chip) return;

  st.retryDisparado = true;
  // Remove painel de retry
  const rp = document.getElementById(`retryPanel${slot}`);
  if (rp) rp.remove();

  // Marcar retry items como aguardando novamente
  st.retryItems.forEach(item => { item.status = 'aguardando'; item._isRetry = true; });

  // Dispara como lote único
  st.filaLotes = [[...st.retryItems]];
  st.loteAtual = st.lotesTotal; // continua numeração
  st.lotesTotal = st.lotesTotal + 1;
  const logEl = document.getElementById(`disparoLog${slot}`);
  if (logEl) { logEl.style.display = 'block'; }
  await dispararLoteChip(slot);
}

function iniciarCountdownLoteChip(slot, duracaoMs) {
  const st = chipSlotState[slot];
  const proxBtn = document.getElementById(`btnProximoLote${slot}`);
  const countEl = document.getElementById(`loteCountdown${slot}`);
  const barEl   = document.getElementById(`loteProgressBar${slot}`);
  if (st.loteCountdownInt) clearInterval(st.loteCountdownInt);
  function tick() {
    const restante = st.loteEsperaFim - Date.now();
    if (restante <= 0) {
      clearInterval(st.loteCountdownInt); st.loteCountdownInt = null;
      if (countEl) countEl.textContent = '00:00';
      if (barEl)   barEl.style.width = '100%';
      if (proxBtn) { proxBtn.disabled = false; proxBtn.style.background = slot===0?'var(--accent)':'#5bb8f5'; }
      notify('✓ Lote liberado!');
      return;
    }
    const min = Math.floor(restante/60000), seg = Math.floor((restante%60000)/1000);
    if (countEl) countEl.textContent = `${String(min).padStart(2,'0')}:${String(seg).padStart(2,'0')}`;
    if (barEl)   barEl.style.width = Math.min(100, ((duracaoMs-restante)/duracaoMs)*100) + '%';
  }
  tick(); st.loteCountdownInt = setInterval(tick, 500);
}

function cancelarLotesChip(slot) {
  const st = chipSlotState[slot];
  if (st.loteEsperaTimer)  { clearTimeout(st.loteEsperaTimer);  st.loteEsperaTimer = null; }
  if (st.loteCountdownInt) { clearInterval(st.loteCountdownInt); st.loteCountdownInt = null; }
  st.filaLotes = []; st.loteAtual = 0; st.lotesTotal = 0;
  st.aguardandoLote = false; st.loteEsperaFim = null;
  st.pausado = false;
  const panel = document.getElementById(`loteEsperaPanel${slot}`);
  if (panel) panel.style.display = 'none';
  const btnEl  = document.getElementById(`btnDisparar${slot}`);
  const btnTxt = document.getElementById(`disparoBtn${slot}`);
  if (btnEl)  btnEl.disabled = false;
  if (btnTxt) btnTxt.textContent = slot===0 ? '🟢 Disparar' : '🔵 Disparar';
  notify('// fila cancelada','warn');
  _atualizarBotaoPausa(slot);
}

function togglePausaChip(slot) {
  const st = chipSlotState[slot];
  if (!st.disparoEmAndamento && !st.aguardandoLote) return; // só age se estiver rodando
  st.pausado = !st.pausado;
  _atualizarBotaoPausa(slot);
  if (st.pausado) {
    notify(`⏸ Chip ${slot+1} pausado — aguardando término do envio atual`, 'warn');
  } else {
    notify(`▶ Chip ${slot+1} retomado`);
  }
}

function _atualizarBotaoPausa(slot) {
  const st = chipSlotState[slot];
  const btn = document.getElementById(`btnPausa${slot}`);
  if (!btn) return;
  const ativo = st.disparoEmAndamento || st.aguardandoLote;
  btn.style.display = ativo ? 'inline-flex' : 'none';
  if (st.pausado) {
    btn.textContent = '▶ Retomar';
    btn.style.borderColor = 'var(--ok)';
    btn.style.color = 'var(--ok)';
  } else {
    btn.textContent = '⏸ Pausar';
    btn.style.borderColor = 'var(--warning)';
    btn.style.color = 'var(--warning)';
  }
}

async function confirmarProximoLoteChip(slot) {
  const st = chipSlotState[slot];
  if (!st.filaLotes.length) return;
  const proxBtn = document.getElementById(`btnProximoLote${slot}`);
  if (proxBtn) proxBtn.disabled = true;
  const panel = document.getElementById(`loteEsperaPanel${slot}`);
  if (panel) panel.style.display = 'none';
  if (st.loteCountdownInt) { clearInterval(st.loteCountdownInt); st.loteCountdownInt = null; }
  if (st.loteEsperaTimer)  { clearTimeout(st.loteEsperaTimer);   st.loteEsperaTimer = null; }
  st.aguardandoLote = false;
  await dispararLoteChip(slot);
}

function atualizarStatusFilaSlot(slot, id, status) {
  const el = document.getElementById(`fila-item-${slot}-${id}`); if (!el) return;
  el.className = `fila-item ${status}`;
  const st = el.querySelector('.fila-item-status'); if (!st) return;
  const labels = { aguardando:'aguardando', enviando:'enviando...', enviado:'✓ enviado', erro:'✗ erro' };
  st.className = `fila-item-status ${status}`; st.textContent = labels[status]||status;
}

