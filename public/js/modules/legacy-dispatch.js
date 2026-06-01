/* ════════════════════════════
   VALIDADOR DE LINKS
════════════════════════════ */
// Domínios atualmente colados no validador — lidos pelos cards sem causar loop
let _validadorLinkDomains = new Set();
const _normValidadorLink = (url) => {
  try { return new URL(url).hostname.replace(/^www\./,'').toLowerCase(); } catch { return url.toLowerCase().trim(); }
};

function previewValidadorLinks() {
  const raw = document.getElementById('validadorLinksInput')?.value || '';
  const links = raw.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
  const el = document.getElementById('validadorLinksPreview');
  if (!el) return;

  // Atualiza a variável global de domínios (usada pelos cards no próximo render)
  _validadorLinkDomains = new Set(links.map(_normValidadorLink));

  if (!links.length) {
    el.innerHTML = '';
    updateMantidosBadge(0, false);
    _updateCardMantidoBadges(); // atualiza badges dos cards sem re-renderizar tudo
    return;
  }

  el.innerHTML = `<div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);margin-bottom:8px">${links.length} link${links.length!==1?'s':''} colado${links.length!==1?'s':''}:</div>` +
    links.map(l => `<div style="background:var(--bg);border:1px solid var(--border2);border-radius:6px;padding:5px 10px;margin-bottom:4px;font-family:'DM Mono',monospace;font-size:9px;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(l)}</div>`).join('');

  // Atualiza badges dos cards visíveis sem re-renderizar a lista inteira
  _updateCardMantidoBadges();

  // Calcula total mantidos para o badge global
  const val = getValData();
  const isAbaValidados = validadorAba === 'validados';
  const mantidos = val.filter(v => {
    if (v.tipo !== 'com-site') return false;
    const isValidado = v.numStatus === 'valido';
    if (isAbaValidados && !isValidado) return false;
    if (!isAbaValidados && isValidado) return false;
    return _validadorLinkDomains.has(_normValidadorLink(v.site || ''));
  }).length;
  updateMantidosBadge(mantidos, true);
}

// Atualiza apenas os badges de "mantido" nos cards já renderizados no DOM
function _updateCardMantidoBadges() {
  const cards = document.querySelectorAll('#valComSiteList .empresa-card[id^="val-card-"]');
  const val = getValData();
  cards.forEach(card => {
    const id = card.id.replace('val-card-', '');
    const v = val.find(x => x.id === id);
    if (!v) return;
    let badge = card.querySelector('.mantido-inline-badge');
    const isMantido = v.site && _validadorLinkDomains.size > 0 && _validadorLinkDomains.has(_normValidadorLink(v.site));
    if (isMantido) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'mantido-inline-badge';
        badge.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-family:\'DM Mono\',monospace;font-size:7px;padding:2px 7px;border-radius:100px;border:1px solid rgba(91,184,245,0.35);background:rgba(91,184,245,0.07);color:#5bb8f5;white-space:nowrap';
        badge.innerHTML = '<span style="width:4px;height:4px;border-radius:50%;background:#5bb8f5;display:inline-block;flex-shrink:0"></span>mantido';
        // Insere após o badge do chip (último span da .empresa-meta)
        const meta = card.querySelector('.empresa-meta');
        if (meta) meta.appendChild(badge);
      }
    } else {
      if (badge) badge.remove();
    }
  });
}

function updateMantidosBadge(count, visible) {
  const badge = document.getElementById('valMantidosBadge');
  const countEl = document.getElementById('valMantidosCount');
  if (!badge || !countEl) return;
  countEl.textContent = count;
  if (visible && count > 0) {
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }
}

function renderValidadorLinks() {
  previewValidadorLinks();
}

function confirmarValidadorLinks() {
  const raw = document.getElementById('validadorLinksInput')?.value || '';
  const links = raw.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
  if (!links.length) { notify('// nenhum link colado','warn'); return; }

  // Normaliza para comparar domínios
  const normLink = (url) => {
    try { return new URL(url).hostname.replace(/^www\./,'').toLowerCase(); } catch { return url.toLowerCase().trim(); }
  };
  const linkDomains = new Set(links.map(normLink));

  const val = getValData();
  // filtra apenas as empresas da aba selecionada (validadorAba)
  const isAbaValidados = validadorAba === 'validados';
  const antes = val.filter(v => v.tipo === 'com-site' && (isAbaValidados ? v.numStatus === 'valido' : v.numStatus !== 'valido')).length;

  const novaVal = val.filter(v => {
    if (v.tipo !== 'com-site') return true; // preserva outros tipos
    const isValidado = v.numStatus === 'valido';
    // se não pertence à aba selecionada, preserva sem tocar
    if (isAbaValidados && !isValidado) return true;
    if (!isAbaValidados && isValidado) return true;
    // pertence à aba: só mantém se o site está na lista
    const empDomain = normLink(v.site || '');
    return linkDomains.has(empDomain);
  });

  const removidos = antes - novaVal.filter(v => v.tipo === 'com-site' && (isAbaValidados ? v.numStatus === 'valido' : v.numStatus !== 'valido')).length;

  // Registra os sites removidos como "já vistos"
  const removedSites = val
    .filter(v => {
      if (v.tipo !== 'com-site') return false;
      const isValidado = v.numStatus === 'valido';
      if (isAbaValidados && !isValidado) return false;
      if (!isAbaValidados && isValidado) return false;
      return !linkDomains.has(normLink(v.site || ''));
    })
    .map(v => v.site)
    .filter(Boolean);
  if (removedSites.length) addExcludedDomains(removedSites);

  saveValData(novaVal);
  document.getElementById('validadorLinksInput').value = '';
  updateMantidosBadge(0, false);
  renderValidacao(); updateBadges();
  const abaLabel = isAbaValidados ? 'Validados' : 'Pendentes/Inválidos';
  notify(`✓ ${links.length} mantidos · ${removidos} removidos → sites já vistos (${abaLabel})`);
}

/* Remove da página atual apenas os itens que NÃO estão nos links colados,
   preservando todas as outras páginas intocadas. */
function limparPaginaValidador() {
  const raw = document.getElementById('validadorLinksInput')?.value || '';
  const links = raw.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));

  const normLink = (url) => {
    try { return new URL(url).hostname.replace(/^www\./,'').toLowerCase(); } catch { return url.toLowerCase().trim(); }
  };
  const linkDomains = new Set(links.map(normLink));

  const val = getValData();
  const isAbaValidados = validadorAba === 'validados';

  // Identifica quais empresas estão na página atual (mesma lógica do renderValidacao)
  const comSite = val.filter(v => v.tipo === 'com-site');
  const activeGroup = isAbaValidados
    ? comSite.filter(v => v.numStatus === 'valido')
    : comSite.filter(v => v.numStatus !== 'valido');

  const totalValPages = Math.max(1, Math.ceil(activeGroup.length / VAL_PG));
  const currentPageIdx = Math.min(valPage, totalValPages);
  const pageItems = activeGroup.slice((currentPageIdx - 1) * VAL_PG, currentPageIdx * VAL_PG);
  const pageIds = new Set(pageItems.map(v => v.id));

  // Remove apenas os itens da página atual que não estão nos links
  let removidos = 0;
  const novaVal = val.filter(v => {
    if (!pageIds.has(v.id)) return true; // fora da página: preserva
    const empDomain = normLink(v.site || '');
    if (linkDomains.has(empDomain)) return true; // está nos links: preserva
    removidos++;
    return false;
  });

  if (!removidos) { notify('// nenhum item removido nesta página', 'warn'); return; }

  // Registra os sites removidos como "já vistos"
  const removedSites = pageItems
    .filter(v => !linkDomains.has(normLink(v.site || '')))
    .map(v => v.site)
    .filter(Boolean);
  addExcludedDomains(removedSites);

  saveValData(novaVal);
  // Ajusta a página se necessário (se a página ficou vazia e havia mais)
  const novaGroup = novaVal.filter(v => {
    if (v.tipo !== 'com-site') return false;
    return isAbaValidados ? v.numStatus === 'valido' : v.numStatus !== 'valido';
  });
  const novasPages = Math.max(1, Math.ceil(novaGroup.length / VAL_PG));
  if (valPage > novasPages) valPage = novasPages;

  renderValidacao(); updateBadges();
  updateMantidosBadge(0, false);
  document.getElementById('validadorLinksInput').value = '';
  const abaLabel = isAbaValidados ? 'Validados' : 'Pendentes/Inválidos';
  notify(`✓ ${removidos} removidos da página ${currentPageIdx} → sites já vistos (${abaLabel})`);
}

function aprovarParaFila(id) {
  const val = getValData();
  const v = val.find(x => x.id === id);
  if (!v || v.numStatus !== 'valido') { notify('// valide o número primeiro','warn'); return; }

  // Manda para a Base de Atribuição (sem dia ainda)
  const atrib = getAtribuicaoData();
  if (atrib.find(a => a.id === v.id)) { notify('// já está na Base de Atribuição','warn'); return; }
  markLeadWhatsappValidatedForQueue(v);
  atrib.push({
    id: v.id, nome: v.nome, site: v.site || '', whatsapp: v.whatsapp,
    instagram: v.instagram, googleUrl: v.googleUrl,
    canal: 'zap', // número validado via WhatsApp
    numStatus: 'valido', whatsappValidationStatus: 'valid',
    status: 'Não enviada', criadoEm: v.importadoEm || todayStr(),
    validadoEm: todayStr(), diaDestino: null,
  });
  saveAtribuicaoData(atrib);

  // Remove da fila de validação
  saveValData(getValData().filter(x => x.id !== id));
  renderValidacao(); updateBadges();
  notify(`✓ ${v.nome} → Base de Atribuição`);
}

function aprovarParaInsta(id) {
  const val = getValData();
  const v = val.find(x => x.id === id);
  if (!v) return;

  // Salva link do insta editado
  const linkInput = document.getElementById(`insta-link-${id}`);
  if (linkInput) v.instagram = linkInput.value.trim();

  // Manda diretamente para a atribuição de Instagram.
  const fila = getInstaFila();
  if (!fila.find(a => a.id === v.id)) {
    fila.push({
      id: v.id, nome: v.nome, site: '', whatsapp: v.whatsapp || '',
      instagram: v.instagram || '', googleUrl: v.googleUrl || '',
      canal: 'insta', // sem WhatsApp validado
      status: 'Não enviada', criadoEm: v.importadoEm || todayStr(),
      validadoEm: todayStr(), diaDestino: null,
    });
    saveInstaFila(fila);
  }

  saveValData(getValData().filter(x => x.id !== id));
  renderValidacao(); updateBadges(); updateAtribTabCounts();
  notify(`✓ ${v.nome} → Atribuição (tag INSTA)`);
}

/* Aprova TODOS os leads validados para Atribuição (ZAP ou INSTA conforme numStatus) */
function aprovarTodosParaAtribuicao() {
  const val = getValData();
  const atrib = getAtribuicaoData();
  const existIds = new Set(atrib.map(a => a.id));
  const instaFila = getInstaFila();
  const instaIds = new Set(instaFila.map(a => a.id));
  let addedZap = 0, addedInsta = 0;

  // Processa leads com número válido → tag ZAP
  val.filter(v => v.numStatus === 'valido' && !existIds.has(v.id)).forEach(v => {
    markLeadWhatsappValidatedForQueue(v);
    atrib.push({
      id: v.id, nome: v.nome, site: '', whatsapp: v.whatsapp,
      instagram: v.instagram || '', googleUrl: v.googleUrl || '',
      canal: 'zap',
      numStatus: 'valido', whatsappValidationStatus: 'valid',
      status: 'Não enviada', criadoEm: v.importadoEm || todayStr(),
      validadoEm: todayStr(), diaDestino: null,
    });
    existIds.add(v.id);
    addedZap++;
  });

  // Processa leads sem número válido (invalido) → tag INSTA
  val.filter(v => v.numStatus === 'invalido' && !instaIds.has(v.id)).forEach(v => {
    instaFila.push({
      id: v.id, nome: v.nome, site: '', whatsapp: '',
      instagram: v.instagram || '', googleUrl: v.googleUrl || '',
      canal: 'insta',
      status: 'Não enviada', criadoEm: v.importadoEm || todayStr(),
      validadoEm: todayStr(), diaDestino: null,
    });
    instaIds.add(v.id);
    addedInsta++;
  });

  if (!addedZap && !addedInsta) { notify('// nenhum lead pronto para atribuição','warn'); return; }

  saveAtribuicaoData(atrib);
  saveInstaFila(instaFila);
  // Remove os aprovados da validação
  const removedIds = new Set([...val.filter(v => v.numStatus === 'valido' || v.numStatus === 'invalido').map(v => v.id)]);
  saveValData(val.filter(v => !removedIds.has(v.id)));
  renderValidacao(); updateBadges(); updateAtribTabCounts();
  let msg = `✓ `;
  if (addedZap)   msg += `${addedZap} ZAP`;
  if (addedInsta) msg += `${addedZap?', ':''}${addedInsta} INSTA`;
  msg += ' → Atribuição';
  notify(msg);
}





/* ─── Per-chip state (indexed 0 = Chip1, 1 = Chip2) ─── */
const chipSlotState = [
  { filaLotes:[], loteAtual:0, lotesTotal:0, aguardandoLote:false, disparoEmAndamento:false, loteEsperaFim:null, loteEsperaTimer:null, loteCountdownInt:null, loteHistorico:[], retryItems:[], retryDisparado:false, ultimoLoteFimTs:null, pausado:false },
  { filaLotes:[], loteAtual:0, lotesTotal:0, aguardandoLote:false, disparoEmAndamento:false, loteEsperaFim:null, loteEsperaTimer:null, loteCountdownInt:null, loteHistorico:[], retryItems:[], retryDisparado:false, ultimoLoteFimTs:null, pausado:false }
];

/* ─── Limit por dia = 120 × nº de chips ─── */
function getDailyLimit() { return Math.max(1, getChips().length) * 120; }

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
      saveWeekData(data); saveFilaDisparo(); updateBadges();
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
  saveFilaDisparo();
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
      if (!res1.ok) throw new Error(`HTTP ${res1.status}`);
      log(`  ① apresentação enviada`);
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
    saveFilaDisparo();
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



/* ════════════════════════════
   RENDER CHIP ACCORDIONS — dinâmico, baseado nos chips cadastrados
════════════════════════════ */
const CHIP_COLORS = [
  { cor: 'var(--accent)',  corHex: '#b8f059', borderAlpha: 'rgba(184,240,89,0.25)',  bgBtn: '',                   txtBtn: '#0a0a0d', spinColor: '#0a0a0d' },
  { cor: '#5bb8f5',        corHex: '#5bb8f5', borderAlpha: 'rgba(91,184,245,0.25)',  bgBtn: '#5bb8f5',            txtBtn: '#0a0a0d', spinColor: '#0a0a0d' },
  { cor: '#c084fc',        corHex: '#c084fc', borderAlpha: 'rgba(192,132,252,0.25)', bgBtn: '#c084fc',            txtBtn: '#0a0a0d', spinColor: '#0a0a0d' },
  { cor: '#fb923c',        corHex: '#fb923c', borderAlpha: 'rgba(251,146,60,0.25)',  bgBtn: '#fb923c',            txtBtn: '#0a0a0d', spinColor: '#0a0a0d' },
];

function renderChipAccordions() {
  const chips = getChips();
  const zapRight = document.getElementById('zapRight');
  if (!zapRight) return;

  // Garante que chipSlotState tem entradas suficientes
  while (chipSlotState.length < chips.length) {
    chipSlotState.push({ filaLotes:[], loteAtual:0, lotesTotal:0, aguardandoLote:false, disparoEmAndamento:false, loteEsperaFim:null, loteEsperaTimer:null, loteCountdownInt:null, loteHistorico:[], retryItems:[], retryDisparado:false, ultimoLoteFimTs:null, pausado:false });
  }

  if (!chips.length) {
    zapRight.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;flex:1;font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);padding:40px">// nenhum chip configurado</div>`;
    return;
  }

  // Salvar estado visual antes de reconstruir
  const _estadoAntes = chips.map((_, slot) => {
    const st = chipSlotState[slot];
    return {
      disparoEmAndamento: st ? st.disparoEmAndamento : false,
      aguardandoLote: st ? st.aguardandoLote : false,
      loteAtual: st ? st.loteAtual : 0,
      lotesTotal: st ? st.lotesTotal : 0,
      pausado: st ? st.pausado : false,
      accordionAberto: document.getElementById(`chipAccordion${slot}`)?.classList.contains('open') || false,
    };
  });

  zapRight.innerHTML = chips.map((chip, slot) => {
    const c = CHIP_COLORS[slot % CHIP_COLORS.length];
    const disparoIcon = slot === 0 ? '🟢' : slot === 1 ? '🔵' : '🟣';
    const bgBtnStyle  = c.bgBtn ? `background:${c.bgBtn};color:${c.txtBtn}` : '';
    const spinStyle   = `border-top-color:${c.spinColor}`;
    return `
    ${slot > 0 ? '<div style="height:1px;background:var(--border);flex-shrink:0;"></div>' : ''}
    <div class="chip-accordion" id="chipAccordion${slot}" data-slot="${slot}">
      <div class="chip-accordion-header" onclick="toggleChipAccordion(${slot})" style="border-color:${c.borderAlpha}">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
          <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:${c.cor}">CHIP ${slot+1}</span>
          <span id="chip${slot+1}Label" style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted);text-transform:none;letter-spacing:0;font-weight:400;">· ${escHtml(chip.nome)}</span>
          <span id="filaCount${slot}" style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted);margin-left:auto;white-space:nowrap">(0 empresas)</span>
        </div>
        <div class="chip-accordion-chevron" id="chevron${slot}">▶</div>
      </div>
      <div class="chip-accordion-body" id="chipBody${slot}">
        <div style="padding:16px;border-bottom:1px solid var(--border);flex-shrink:0">
          <div style="margin-bottom:12px">
            <label>Chip</label>
            <div id="chip${slot+1}Info" style="font-family:'DM Mono',monospace;font-size:10px;color:var(--text2);padding:8px 12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border2)">${escHtml(chip.nome)} · ${escHtml(chip.instance)}</div>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:0">
            <button class="btn btn-danger" style="font-size:11px" onclick="limparFilaChip(${slot})">Limpar fila</button>
            <button class="btn btn-ghost" id="btnPausa${slot}" onclick="togglePausaChip(${slot})" style="display:none;font-size:11px;border-color:var(--warning);color:var(--warning)">⏸ Pausar</button>
            <button class="btn btn-primary" style="flex:1;${bgBtnStyle}" id="btnDisparar${slot}" onclick="iniciarDisparoChip(${slot})">
              <div class="spinner" id="spinner${slot}" style="${spinStyle}"></div>
              <span id="disparoBtn${slot}">${disparoIcon} Disparar</span>
            </button>
          </div>
          <div class="lote-espera-panel" id="loteEsperaPanel${slot}" style="display:none;margin-top:10px">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <div style="flex:1">
                <div style="font-family:'DM Mono',monospace;font-size:10px;color:${c.cor};margin-bottom:4px" id="loteEsperaTitle${slot}">⏱ Aguardando lote...</div>
                <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted)">Próximo lote em <span id="loteCountdown${slot}" style="color:var(--text2)">--:--</span></div>
              </div>
              <button class="btn btn-ghost" style="font-size:10px;border-color:var(--warning);color:var(--warning)" onclick="cancelarLotesChip(${slot})">✕</button>
              <button class="btn btn-primary" style="width:auto;font-size:11px;${bgBtnStyle}" id="btnProximoLote${slot}" onclick="confirmarProximoLoteChip(${slot})" disabled>Próximo →</button>
            </div>
            <div style="margin-top:8px;background:var(--surface2);border-radius:6px;height:3px;overflow:hidden">
              <div id="loteProgressBar${slot}" style="height:100%;background:${c.cor};width:0%;transition:width 0.5s linear"></div>
            </div>
          </div>
        </div>
        <div style="padding:12px 16px 6px;flex-shrink:0">
          <div style="font-family:'DM Mono',monospace;font-size:8px;letter-spacing:0.12em;color:${c.cor};text-transform:uppercase;margin-bottom:8px">Fila Chip ${slot+1}</div>
          <div id="chip${slot+1}FilaButtons" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"></div>
        </div>
        <div class="chip-fila-scroll" id="chip${slot}FilaScroll">
          <div class="fila-empty" id="filaVazia${slot}">Nenhuma empresa na fila.</div>
          <div class="fila-items" id="filaItens${slot}" style="display:none;padding:0 16px 16px"></div>
        </div>
        <div class="disparo-log" id="disparoLog${slot}"></div>
      </div>
    </div>`;
  }).join('');

  // Restaurar estado visual dos chips que estavam em andamento
  chips.forEach((chip, slot) => {
    const est = _estadoAntes[slot];
    if (!est) return;
    if (est.accordionAberto) {
      const acc = document.getElementById(`chipAccordion${slot}`);
      if (acc) acc.classList.add('open');
    }
    const btnEl  = document.getElementById(`btnDisparar${slot}`);
    const spinEl = document.getElementById(`spinner${slot}`);
    const btnTxt = document.getElementById(`disparoBtn${slot}`);
    const pausaEl = document.getElementById(`btnPausa${slot}`);
    if (est.disparoEmAndamento) {
      if (btnEl)  btnEl.disabled = true;
      if (spinEl) spinEl.style.display = 'block';
      if (btnTxt) btnTxt.textContent = est.pausado
        ? `⏸ Pausado (${est.loteAtual}/${est.lotesTotal})`
        : `⏳ Enviando lote ${est.loteAtual}/${est.lotesTotal}...`;
      if (pausaEl) pausaEl.style.display = 'inline-flex';
    } else if (est.aguardandoLote) {
      if (btnEl)  btnEl.disabled = true;
      if (btnTxt) btnTxt.textContent = `⏱ Aguardando próximo lote...`;
      const panel = document.getElementById(`loteEsperaPanel${slot}`);
      if (panel) panel.style.display = 'block';
    }
  });
}

function renderFilaZap() {
  const devolvidos = devolverZapNaoValidadoParaValidacao();
  if (devolvidos) notify(`↩ ${devolvidos} lead(s) sem WhatsApp validado voltaram para Validação`, 'warn');
  sincronizarFilaComEnviados();
  const chips = getChips();
  const weekDays = currentWeekDays();
  const today = todayStr();

  // Só reconstrói os accordions se nenhum disparo estiver em andamento
  // (evita resetar botão/spinner ao trocar de aba durante o envio)
  const disparoAtivo = chipSlotState.some(st => st.disparoEmAndamento || st.aguardandoLote);
  if (!disparoAtivo) {
    renderChipAccordions();
  }

  // Populate chip panels (labels/info já inseridos pelo renderChipAccordions)
  chips.forEach((chip, slot) => {
    const infoEl  = document.getElementById(`chip${slot+1}Info`);
    const labelEl = document.getElementById(`chip${slot+1}Label`);
    if (infoEl)  infoEl.textContent  = `${chip.nome} · ${chip.instance}`;
    if (labelEl) labelEl.textContent = `· ${chip.nome}`;
  });

  // Set disparoChipId for empresa listing (use chip[0] by default)
  if (!disparoChipId && chips.length) disparoChipId = chips[0].id;

  if (!weekDays.includes(disparoDay) && disparoDay !== 'backlog') disparoDay = today;

  const backlogCount = getZapBacklog().length;
  const backlogTab = `<div class="day-tab${disparoDay==='backlog'?' active':''}" onclick="setDisparoDay('backlog')"
    style="${disparoDay==='backlog'?'':''}">
    📦 Backlog
    ${backlogCount>0?`<span class="day-count">${backlogCount}</span>`:''}
  </div>`;

  document.getElementById('disparoDayTabs').innerHTML = backlogTab + weekDays.map(day => {
    const data  = ensureWeekData();
    const count = (data.days[day]||[]).filter(e => e.whatsapp && (e.status||'Não enviada')==='Não enviada').length;
    const active= day === disparoDay;
    return `<div class="day-tab${active?' active':''}" onclick="setDisparoDay('${day}')">
      ${dayLabel(day)}${day===today?' <span style="color:var(--accent);font-size:8px">●</span>':''}
      ${count>0?`<span class="day-count">${count}</span>`:''}
    </div>`;
  }).join('');

  if (disparoDay === 'backlog') {
    renderZapBacklogPanel();
  } else {
    renderDisparoEmpresas();
    chips.forEach((_, s) => renderFilaSlot(s, disparoDay));
    if (!chips.length) { /* nada a renderizar */ }
  }
}

/* ════════════════════════════
   RENDER DISPARO EMPRESAS
   Popula disparoStatusTabs + disparoEmpresasList
════════════════════════════ */
function renderDisparoEmpresas() {
  const data     = ensureWeekData();
  const chips    = getChips();
  const weekDays = currentWeekDays();
  if (!weekDays.includes(disparoDay)) disparoDay = todayStr();

  const emps = data.days[disparoDay] || [];

  // ── Status tabs ──
  const statusTabsEl = document.getElementById('disparoStatusTabs');
  if (statusTabsEl) {
    const counts = {};
    STATUS_OPTIONS.forEach(s => { counts[s] = emps.filter(e => (e.status||'Não enviada')===s).length; });
    statusTabsEl.innerHTML = STATUS_OPTIONS.map(s =>
      `<div class="status-tab${disparoStatus===s?' active':''}" onclick="setDisparoStatus('${s}')">
        ${s} <span class="st-count">${counts[s]}</span>
      </div>`
    ).join('');
  }

  // ── Stats row ──
  const statsEl = document.getElementById('disparoStats');
  if (statsEl) {
    const total   = emps.length;
    const comWa   = emps.filter(e => e.whatsapp).length;
    const emFila  = emps.filter(e => (e.status||'Não enviada')==='Em fila').length;
    const enviado = emps.filter(e => (e.status||'Não enviada')==='Enviada').length;
    statsEl.innerHTML = total
      ? `<span style="font-family:'DM Mono',monospace;font-size:9px;color:var(--muted)">${total} leads · <span style="color:var(--ok)">${comWa} com WhatsApp</span> · <span style="color:var(--accent)">${emFila} na fila</span> · <span style="color:var(--text2)">${enviado} enviados</span></span>`
      : '';
  }

  // ── Lista de empresas ──
  const listEl = document.getElementById('disparoEmpresasList');
  if (!listEl) return;

  const filtered = emps.filter(e => (e.status||'Não enviada') === disparoStatus);
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / DISPARO_PG));
  if (disparoPage > totalPages) disparoPage = totalPages;
  const pageItems = filtered.slice((disparoPage-1)*DISPARO_PG, disparoPage*DISPARO_PG);

  if (!totalItems) {
    listEl.innerHTML = `<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);text-align:center;padding:32px">// nenhuma empresa com status "${disparoStatus}" neste dia</div>`;
    renderPagination('disparoPagination', 1, 1, 0, DISPARO_PG, 'goDisparoPage', 'changeDisparoPgSize');
    return;
  }

  listEl.innerHTML = pageItems.map(e => {
    const googleUrl = e.googleUrl || '';
    const nomeDisplay = googleUrl
      ? `<a href="${escHtml(googleUrl)}" target="_blank" style="color:var(--text);text-decoration:none">${escHtml(e.nome)}</a>`
      : escHtml(e.nome);

    // Verificar em qual chip está na fila — cruza fila do chip com status real do lead
    const empStatus = e.status || 'Não enviada';
    const emFilaReal = empStatus === 'Em fila';
    const naFila = chips.map((c, slot) => {
      const fila = getFilaChip(c.id);
      const idx  = fila.findIndex(f => f.id === e.id);
      // Se está na fila do chip mas o status do lead não é "Em fila", remove a entrada fantasma
      if (idx >= 0 && !emFilaReal) {
        fila.splice(idx, 1);
        saveFilaDisparo();
        return { slot, nome: c.nome, naFila: false };
      }
      return { slot, nome: c.nome, naFila: idx >= 0 };
    });

    const botoes = chips.map((c, slot) => {
      const { naFila: emFila } = naFila[slot];
      const cor    = slot === 0 ? 'var(--accent)' : '#5bb8f5';
      const corBg  = slot === 0 ? 'rgba(184,240,89,0.08)' : 'rgba(91,184,245,0.08)';
      const qtdNoDia = getFilaChipNoDia(c.id, disparoDay).length;
      const cheio  = !emFila && qtdNoDia >= CHIP_LIMIT;
      const label  = emFila ? `✓ C${slot+1}` : cheio ? `✕ C${slot+1}` : `+ C${slot+1}`;
      const title  = emFila
        ? `Remover do Chip ${slot+1} — ${escHtml(c.nome)}`
        : cheio
          ? `Chip ${slot+1} cheio (${CHIP_LIMIT}/${CHIP_LIMIT}) · clique para redirecionar ao próximo disponível`
          : `Adicionar ao Chip ${slot+1} — ${escHtml(c.nome)} (${qtdNoDia}/${CHIP_LIMIT})`;
      return `<button onclick="toggleFilaSlotEmpresa(${slot},'${e.id}')"
        style="font-family:'DM Mono',monospace;font-size:8px;padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid ${emFila?cor:cheio?'rgba(255,92,92,0.4)':'var(--border2)'};background:${emFila?corBg:cheio?'rgba(255,92,92,0.06)':'transparent'};color:${emFila?cor:cheio?'var(--error)':'var(--muted)'};transition:all 0.15s;white-space:nowrap"
        title="${title}">
        ${label}
      </button>`;
    }).join('');

    const semChip = chips.length === 0;
    const isEnviada = STATUS_FORWARD_ONLY.includes(e.status||'') || (e.status||'') === 'Enviada';

    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:11px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nomeDisplay}</div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--text2);display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">
          ${e.whatsapp?`<span style="color:var(--ok)">📱 ${escHtml(e.whatsapp)}</span>`:'<span style="color:var(--error)">sem WhatsApp</span>'}
          ${e.site?`<a href="${escHtml(e.site)}" target="_blank" style="color:var(--muted);text-decoration:none">${escHtml(e.site.replace(/^https?:\/\/(www\.)?/,'').split('/')[0])}</a>`:''}
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;align-items:center">
        <button class="lead-drawer-open-btn" onclick="openLeadDrawer('${e.id}')">Ficha</button>
        ${isEnviada
          ? `<span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--ok)">✓ enviado</span>`
          : semChip
            ? `<span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted)">configure chips primeiro</span>`
            : (e.whatsapp ? botoes : `<span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--error)">sem WhatsApp</span>`)
        }
        <button onclick="moverParaBacklogZapDoDia('${e.id}','${disparoDay}')" title="Mover para Backlog Zap"
          style="background:none;border:1px solid var(--border2);color:var(--muted);border-radius:6px;font-family:'DM Mono',monospace;font-size:8px;padding:3px 8px;cursor:pointer;transition:all 0.15s;margin-left:2px"
          onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
          onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--muted)'">↩</button>
        <button onclick="abrirModalExcluirLead('${e.id}','${disparoDay}')"
          title="Excluir lead da plataforma"
          style="background:none;border:1px solid transparent;color:var(--muted);border-radius:6px;font-family:'DM Mono',monospace;font-size:10px;padding:3px 7px;cursor:pointer;transition:all 0.18s;margin-left:2px"
          onmouseover="this.style.borderColor='var(--error)';this.style.color='var(--error)';this.style.background='rgba(255,92,92,0.06)'"
          onmouseout="this.style.borderColor='transparent';this.style.color='var(--muted)';this.style.background='none'">✕</button>
      </div>
    </div>`;
  }).join('');

  renderPagination('disparoPagination', disparoPage, totalPages, totalItems, DISPARO_PG, 'goDisparoPage', 'changeDisparoPgSize');
}

function setDisparoChip(id) {
  disparoChipId = id;
  renderFilaZap();
}

/* ─── Accordion dos Chips (layout 50/50) ─── */
function toggleChipAccordion(slot) {
  const chips = getChips();
  // Fecha todos os outros accordions
  chips.forEach((_, s) => {
    if (s !== slot) {
      const acc = document.getElementById('chipAccordion' + s);
      if (acc) acc.classList.remove('open');
    }
  });
  // Toggle o clicado
  const accSel = document.getElementById('chipAccordion' + slot);
  if (accSel) accSel.classList.toggle('open');
}

function setDisparoDay(day) { disparoDay = day; disparoStatus = 'Não enviada'; disparoPage = 1; renderFilaZap(); }
function setDisparoStatus(st) { disparoStatus = st; disparoPage = 1; renderDisparoEmpresas(); }

function renderFila0() { renderFilaSlot(0, disparoDay); }
function renderFila1() { renderFilaSlot(1, disparoDay); }

function renderFilaSlot(slot, filterDay) {
  const today = todayStr();
  const dayFiltro = filterDay || disparoDay || today;
  const isToday = dayFiltro === today;
  const chips = getChips();
  const chip = chips[slot] || null;
  const chipId = chip ? chip.id : null;
  const st = chipSlotState[slot];

  // Filtrar fila pelo dia selecionado: cruzar IDs da fila com empresas do dia
  const filaGlobal = chipId ? getFilaChip(chipId) : [];
  const data = ensureWeekData();
  const idsNoDia = new Set((data.days[dayFiltro]||[]).map(e => e.id));
  const filaCompleta = filaGlobal.filter(f => idsNoDia.has(f.id));

  const countEl = document.getElementById(`filaCount${slot}`);
  const vaziEl  = document.getElementById(`filaVazia${slot}`);
  const itensEl = document.getElementById(`filaItens${slot}`);
  if (!countEl) return;

  // Botao Disparar: desativado se o dia selecionado nao for hoje
  const btnDisparar = document.getElementById(`btnDisparar${slot}`);
  const btnTxt = document.getElementById(`disparoBtn${slot}`);
  if (btnDisparar && !st.disparoEmAndamento && !st.aguardandoLote) {
    if (!isToday) {
      btnDisparar.disabled = true;
      btnDisparar.title = 'Disparo disponivel apenas no dia de hoje';
      if (btnTxt) btnTxt.textContent = slot === 0 ? '🟢 Disponivel em ' + dayLabelShort(dayFiltro) : '🔵 Disponivel em ' + dayLabelShort(dayFiltro);
    } else {
      btnDisparar.disabled = false;
      btnDisparar.title = '';
      if (btnTxt) btnTxt.textContent = slot === 0 ? '🟢 Disparar' : '🔵 Disparar';
    }
  }

  // Contagem: aguardando/erro ativos (do dia filtrado)
  const aguardando = filaCompleta.filter(f => f.status === 'aguardando').length;
  const erros = filaCompleta.filter(f => f.status === 'erro').length;
  const enviados = filaCompleta.filter(f => f.status === 'enviado').length;
  const totalNoDia = filaCompleta.length;
  const cheio = totalNoDia >= CHIP_LIMIT;
  countEl.textContent = `(${totalNoDia}/${CHIP_LIMIT} · ${aguardando} aguardando · ${erros} erro · ${enviados} enviado${enviados!==1?'s':''})`;
  countEl.style.color = cheio ? 'var(--error)' : totalNoDia >= CHIP_LIMIT * 0.8 ? 'var(--warning)' : '';
  const vazia = filaCompleta.length === 0 && (!st.loteHistorico || !st.loteHistorico.length);
  vaziEl.style.display  = vazia ? 'block' : 'none';
  itensEl.style.display = vazia ? 'none'  : 'flex';
  if (vazia) { itensEl.innerHTML = ''; return; }

  const LOTE_SIZE = getLoteSize();
  let html = '';

  // ── Histórico de lotes já disparados ──
  (st.loteHistorico || []).forEach(lhist => {
    const todosEnviados = lhist.items.every(i => i.status === 'enviado');
    const cor    = todosEnviados ? 'var(--ok)' : 'var(--warning)';
    const border = todosEnviados ? 'rgba(78,203,113,0.25)' : 'rgba(240,164,41,0.25)';
    const bg     = todosEnviados ? 'rgba(78,203,113,0.04)' : 'rgba(240,164,41,0.04)';
    const label  = `LOTE ${lhist.num} — ${lhist.env}/${lhist.items.length} enviados`;
    const histId = `lote-hist-${slot}-${lhist.num}`;
    html += `<div style="margin-bottom:6px;border-radius:8px;background:${bg};border:1px solid ${border};overflow:hidden">
      <div style="display:flex;align-items:center;gap:10px;padding:7px 12px;cursor:pointer" onclick="toggleLoteHist('${histId}')">
        <span style="font-family:'DM Mono',monospace;font-size:9px;font-weight:700;letter-spacing:0.1em;color:${cor}">${label}</span>
        <span style="flex:1;height:1px;background:${border}"></span>
        <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted)">${todosEnviados?'✓ concluído':'parcial'}</span>
        <span id="${histId}-chev" style="font-size:9px;color:var(--muted);transition:transform 0.2s">▶</span>
      </div>
      <div id="${histId}" style="display:none;border-top:1px solid ${border}">
        ${lhist.items.map(item => {
          const ok = item.status === 'enviado';
          return `<div style="display:flex;align-items:center;gap:10px;padding:5px 12px;border-bottom:1px solid ${border};font-size:10px">
            <span style="font-family:'DM Mono',monospace;font-size:9px;color:${ok?'var(--ok)':'var(--error)'};flex-shrink:0">${ok?'✓':'✗'}</span>
            <span style="flex:1;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(item.nome)}</span>
            <span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted)">${item.whatsapp||''}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  });

  // ── Itens ativos ──
  // Usamos filaCompleta para agrupar lotes corretamente (enviados ocupam posição no lote)
  // e renderizamos todos — enviados aparecem com badge verde e sem interação de edição
  const loteHistLen = (st.loteHistorico||[]).length;
  const imgSrcsToSet = []; // { id, src } para setar após innerHTML

  // Agrupar filaCompleta em lotes de LOTE_SIZE
  const lotes = [];
  for (let i = 0; i < filaCompleta.length; i += LOTE_SIZE) {
    lotes.push(filaCompleta.slice(i, i + LOTE_SIZE));
  }

  lotes.forEach((loteItems, loteIdx) => {
    const loteNum = loteHistLen + loteIdx + 1;
    const pendentesNoLote = loteItems.filter(f => f.status !== 'enviado').length;
    const totalNoLote = loteItems.length;
    const todosEnviados = loteItems.every(f => f.status === 'enviado');
    // Lote é "completo" se tem LOTE_SIZE itens OU se não é o último (lotes intermediários sempre são completos)
    const isUltimoLote = loteIdx === lotes.length - 1;
    const completo = totalNoLote >= LOTE_SIZE || !isUltimoLote;
    const cor = todosEnviados ? 'var(--ok)' : completo ? 'var(--accent)' : 'var(--warning)';
    const borderCor = todosEnviados ? 'rgba(78,203,113,0.25)' : completo ? 'rgba(184,240,89,0.25)' : 'rgba(240,164,41,0.25)';
    const bgCor = todosEnviados ? 'rgba(78,203,113,0.04)' : completo ? 'rgba(184,240,89,0.05)' : 'rgba(240,164,41,0.05)';

    let label;
    if (todosEnviados) {
      label = `LOTE ${loteNum} — todos enviados`;
    } else if (completo) {
      label = `LOTE ${loteNum} — #${loteIdx*LOTE_SIZE+1}–${loteIdx*LOTE_SIZE+totalNoLote}`;
    } else {
      label = `LOTE ${loteNum} — #${loteIdx*LOTE_SIZE+1}–${loteIdx*LOTE_SIZE+totalNoLote} (${pendentesNoLote} aguardando)`;
    }

    const loteRamoId = getLoteRamo(chipId, loteNum);
    const loteImg    = getLoteImagem(chipId, loteNum); // do cache em memória
    const imgIdbKey  = getLoteImgKey(chipId, loteNum);
    const ramosOpts  = getRamos().map(r=>`<option value="${r.id}"${loteRamoId===r.id?' selected':''} style="background:var(--surface3)">${escHtml(r.nome)}</option>`).join('');
    const imgPreviewId = `lote-img-preview-${slot}-${loteNum}`;
    if (loteImg) imgSrcsToSet.push({ id: imgPreviewId, src: loteImg });

    html += `<div style="margin:${loteIdx===0&&!loteHistLen?'0':'10px'} 0 6px;border-radius:8px;background:${bgCor};border:1px solid ${borderCor};overflow:hidden">
      <div style="display:flex;align-items:center;gap:10px;padding:7px 12px">
        <span style="font-family:'DM Mono',monospace;font-size:9px;font-weight:700;letter-spacing:0.12em;color:${cor}">${label}</span>
        <span style="flex:1;height:1px;background:${borderCor}"></span>
        ${todosEnviados?'<span style="font-family:\'DM Mono\',monospace;font-size:8px;color:var(--ok)">✓ concluído</span>':!completo?`<span style="font-family:'DM Mono',monospace;font-size:8px;color:var(--warning)">${LOTE_SIZE-totalNoLote} restantes</span>`:'<span style="font-family:\'DM Mono\',monospace;font-size:8px;color:var(--accent)">✓ completo</span>'}
      </div>
      <div style="display:flex;align-items:flex-start;gap:10px;padding:0 12px 10px;border-top:1px solid ${borderCor}">
        <div style="flex:1">
          <div style="font-family:'DM Mono',monospace;font-size:7px;letter-spacing:0.1em;color:var(--muted);margin-bottom:4px;padding-top:8px">RAMO DO TEMPLATE</div>
          <select style="background:var(--surface3);border:1px solid var(--border2);border-radius:6px;color:var(--text2);font-family:'DM Mono',monospace;font-size:9px;padding:5px 8px;width:100%;outline:none" onchange="onLoteRamoChange('${chipId}',${loteNum},this.value,true,${slot})">
            <option value="" style="background:var(--surface3)">— sem ramo (geral) —</option>
            ${ramosOpts}
          </select>
        </div>
        <div style="flex-shrink:0;min-width:130px">
          <div style="font-family:'DM Mono',monospace;font-size:7px;letter-spacing:0.1em;color:var(--accent);margin-bottom:4px;padding-top:8px">IMAGEM DO LOTE</div>
          <div class="fila-img-area${loteImg?' has-img':''}" onclick="document.getElementById('lote-img-s${slot}-${loteNum}').click()">
            ${loteImg
              ? `<img id="${imgPreviewId}" data-lote-img-key="${imgIdbKey}" alt="preview" style="max-width:100%;max-height:100px;object-fit:contain;border-radius:5px;display:block"/>
                 <div class="fila-img-ok" style="font-family:'DM Mono',monospace;font-size:9px;color:var(--ok);font-weight:700;margin-top:4px">✓ imagem inserida</div>
                 <button class="fila-remove-btn" onclick="event.stopPropagation();onLoteImgRemove('${chipId}',${loteNum},true,${slot})">×</button>`
              : `<img id="${imgPreviewId}" data-lote-img-key="${imgIdbKey}" alt="" style="display:none;max-width:100%;max-height:100px;object-fit:contain;border-radius:5px"/>
                 <div class="fila-img-ok" style="display:none;font-family:'DM Mono',monospace;font-size:9px;color:var(--ok);font-weight:700;margin-top:4px">✓ imagem inserida</div>
                 <button class="fila-remove-btn" style="display:none" onclick="event.stopPropagation();onLoteImgRemove('${chipId}',${loteNum},true,${slot})">×</button>
                 <span class="fila-img-label">📎 clique para inserir</span>`
            }
          </div>
          <input type="file" accept="image/*" class="fila-img-input" id="lote-img-s${slot}-${loteNum}" onchange="onLoteImgChange('${chipId}',${loteNum},this,true,${slot})"/>
        </div>
      </div>
    </div>`;

    // Renderizar itens do lote
    loteItems.forEach((item, itemIdx) => {
      const waNum = item.whatsapp.replace(/\D/g,'');
      const labels = { aguardando:'aguardando', enviando:'enviando...', enviado:'✓ enviado', erro:'✗ erro' };
      const aberto = item.aberto || false;
      const isEnviado = item.status === 'enviado';
      const isErro = item.status === 'erro';
      const posGlobal = loteIdx * LOTE_SIZE + itemIdx + 1;

      if (isEnviado) {
        // Enviados: linha compacta, sem edição, sem botão remover
        html += `<div class="fila-item enviado" id="fila-item-${slot}-${item.id}" style="opacity:0.55">
          <div class="fila-item-header" style="cursor:default">
            <div class="fila-item-num" style="color:var(--muted)">${posGlobal}</div>
            <div class="fila-item-nome" style="color:var(--muted)">${escHtml(item.nome)}</div>
            <div class="fila-item-wa" style="color:var(--muted)">+${waNum}</div>
            <div class="fila-item-status enviado">✓ enviado</div>
            <button class="lead-drawer-open-btn" onclick="event.stopPropagation();openLeadDrawer('${item.id}')">Ficha</button>
          </div>
        </div>`;
      } else {
        html += `<div class="fila-item ${item.status}" id="fila-item-${slot}-${item.id}">
          <div class="fila-item-header" onclick="toggleFilaItemSlot(${slot},'${item.id}')" style="cursor:pointer;user-select:none">
            <div class="fila-item-num">${posGlobal}</div>
            <div class="fila-item-nome">${item.site ? `<a href="${escHtml(item.site)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none" title="${escHtml(item.site)}" onclick="event.stopPropagation()">${escHtml(item.nome)}</a>` : escHtml(item.nome)}</div>
            <div class="fila-item-wa">+${waNum}</div>
            <div class="fila-item-status ${item.status}">${labels[item.status]||item.status}</div>
            <button class="lead-drawer-open-btn" onclick="event.stopPropagation();openLeadDrawer('${item.id}')">Ficha</button>
            <div style="color:var(--muted);font-size:12px;margin-left:4px;transition:transform 0.2s;transform:rotate(${aberto?'90':'0'}deg)">▶</div>
            ${!isErro?`<button class="fila-remove-btn" style="position:static;top:auto;right:auto;width:22px;height:22px" onclick="event.stopPropagation();removerFilaSlot(${slot},'${item.id}')">×</button>`:''}
          </div>
          <div class="fila-item-body" style="display:${aberto?'flex':'none'}">
            <div style="width:100%">
              <div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted);margin-bottom:4px">① APRESENTAÇÃO</div>
              <textarea class="fila-msg-area" id="fila-msg-${slot}-${item.id}" style="background:var(--surface2);border-radius:8px;padding:10px 12px;font-family:'DM Mono',monospace;font-size:9px;color:var(--text2);line-height:1.7;min-height:80px;border:1px solid var(--border2);resize:vertical;width:100%;outline:none" oninput="atualizarMsgFilaSlot(${slot},'${item.id}',this.value)">${escHtml(item.mensagem||'')}</textarea>
              <button class="fila-msg-shuffle" onclick="shuffleFilaMsgSlot(${slot},'${item.id}')">↻ sortear</button>
            </div>
          </div>
        </div>`;
      }
    });
  });

  itensEl.innerHTML = html;

  // Setar src das imagens que ja estao no cache em memoria
  imgSrcsToSet.forEach(({ id, src }) => {
    const el = document.getElementById(id);
    if (el) el.src = src;
  });

  // Para lotes cujo cache ainda nao tem nada, busca do IDB de forma assincrona
  lotes.forEach((loteItems, loteIdx) => {
    const loteNum2 = loteHistLen + loteIdx + 1;
    const k = getLoteImgKey(chipId, loteNum2);
    if (_imgCache[k] !== undefined) return; // ja carregado (null ou base64)
    _imgCache[k] = null; // marca como "carregando" para nao buscar de novo
    idbGet(k).then(val => {
      if (!val) return;
      _imgCache[k] = val;
      const imgEl = document.getElementById(`lote-img-preview-${slot}-${loteNum2}`);
      if (!imgEl) return;
      imgEl.src = val;
      imgEl.style.display = 'block';
      const wrapper = imgEl.closest('.fila-img-area');
      if (wrapper) {
        wrapper.classList.add('has-img');
        const label = wrapper.querySelector('.fila-img-label');
        if (label) label.style.display = 'none';
        const ok = wrapper.querySelector('.fila-img-ok');
        if (ok) ok.style.display = 'flex';
        const rmBtn = wrapper.querySelector('.fila-remove-btn');
        if (rmBtn) rmBtn.style.display = 'flex';
      }
    }).catch(() => {});
  });
}

function toggleLoteHist(id) {
  const el = document.getElementById(id);
  const chev = document.getElementById(id + '-chev');
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (chev) chev.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
}



// ── Configuração por lote (ramo — sem imagem aqui) ────────────────
const LOTE_CFG_KEY = 'vs_lote_cfg_v1';
function getLoteCfg() {
  try {
    const cfg = JSON.parse(localStorage.getItem(LOTE_CFG_KEY) || '{}');
    return cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : {};
  } catch(e) {
    return {};
  }
}
function saveLoteCfg(cfg) {
  try { localStorage.setItem(LOTE_CFG_KEY, JSON.stringify(cfg)); } catch(e) {}
}
function getLoteCfgKey(chipId, loteNum) { return `chip-${chipId}-lote-${loteNum}`; }
function getLoteRamo(chipId, loteNum) {
  const cfg = getLoteCfg();
  return (cfg[getLoteCfgKey(chipId, loteNum)] || {}).ramoId || null;
}
function setLoteRamo(chipId, loteNum, ramoId) {
  const cfg = getLoteCfg();
  const k = getLoteCfgKey(chipId, loteNum);
  if (!cfg[k]) cfg[k] = {};
  cfg[k].ramoId = ramoId || null;
  saveLoteCfg(cfg);
}

// ── IndexedDB para imagens de lote (suporta arquivos grandes >5MB) ──
const IDB_NAME = 'vs_lote_imgs';
const IDB_STORE = 'imgs';
let _idb = null;
function abrirIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = e => { _idb = e.target.result; res(_idb); };
    req.onerror   = e => rej(e.target.error);
  });
}
function idbSet(key, value) {
  return abrirIDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(value, key);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  }));
}
function idbGet(key) {
  return abrirIDB().then(db => new Promise((res, rej) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    req.onsuccess = e => res(e.target.result || null);
    req.onerror   = e => rej(e.target.error);
  }));
}
function idbDel(key) {
  return abrirIDB().then(db => new Promise((res, rej) => {
    const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).delete(key);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  }));
}
function idbGetAllKeys() {
  return abrirIDB().then(db => new Promise((res, rej) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAllKeys();
    req.onsuccess = e => res(e.target.result || []);
    req.onerror   = e => rej(e.target.error);
  }));
}

// Cache em memória para imagens já carregadas nesta sessão
const _imgCache = {};

function getLoteImgKey(chipId, loteNum) { return `chip-${chipId}-lote-${loteNum}`; }

// Retorna a imagem do cache síncrono (pode ser null enquanto ainda não carregou)
function getLoteImagem(chipId, loteNum) {
  return _imgCache[getLoteImgKey(chipId, loteNum)] || null;
}

// Carrega a imagem do IDB para o cache e re-renderiza o slot
function carregarImagensLote(chipId, loteNum, slot, isSlot) {
  const k = getLoteImgKey(chipId, loteNum);
  if (_imgCache[k] !== undefined) return; // já carregado
  idbGet(k).then(val => {
    _imgCache[k] = val || null;
    if (val) {
      // Atualiza apenas o elemento de preview sem re-renderizar tudo
      const previewEls = document.querySelectorAll(`[data-lote-img-key="${k}"]`);
      previewEls.forEach(el => {
        el.src = val;
        const wrapper = el.closest('.fila-img-area');
        if (wrapper) {
          wrapper.classList.add('has-img');
          // Garante que o label de placeholder não apareça
          const label = wrapper.querySelector('.fila-img-label');
          if (label) label.style.display = 'none';
          const ok = wrapper.querySelector('.fila-img-ok');
          if (ok) ok.style.display = '';
          const rmBtn = wrapper.querySelector('.fila-remove-btn');
          if (rmBtn) rmBtn.style.display = '';
        }
      });
    }
  }).catch(() => {});
}

function setLoteImagem(chipId, loteNum, base64, nome) {
  const k = getLoteImgKey(chipId, loteNum);
  _imgCache[k] = base64 || null;
  return idbSet(k, base64 || null);
}

function removerLoteImagem(chipId, loteNum) {
  const k = getLoteImgKey(chipId, loteNum);
  _imgCache[k] = null;
  return idbDel(k);
}

// Limpa imagens de lotes que já não existem em nenhum chip (limpeza automática)
function limparImagensOlfas() {
  const chips = getChips();
  idbGetAllKeys().then(keys => {
    keys.forEach(k => {
      const m = k.match(/^chip-(.+)-lote-(\d+)$/);
      if (!m) return;
      const chipId = m[1], loteNum = parseInt(m[2]);
      const chip = chips.find(c => c.id === chipId);
      if (!chip) { idbDel(k); delete _imgCache[k]; return; }
      const fila = getFilaChip(chipId);
      const LOTE_SIZE = getLoteSize();
      const maxLote = Math.ceil(fila.length / LOTE_SIZE);
      if (loteNum > maxLote) { idbDel(k); delete _imgCache[k]; }
    });
  }).catch(() => {});
}

function onLoteRamoChange(chipId, loteNum, ramoId, isSlot, slot) {
  setLoteRamo(chipId, loteNum, ramoId);
  const LOTE_SIZE = getLoteSize();
  // Usa fila filtrada pelo dia — mesmos itens e mesma ordem que o render
  const filaDia = getFilaChipNoDia(chipId, disparoDay);
  const loteIdx = loteNum - 1;
  const inicio = loteIdx * LOTE_SIZE;
  const fim = Math.min(inicio + LOTE_SIZE, filaDia.length);
  // Atualiza os itens por referência (eles existem também em filaDisparo[chipId])
  for (let i = inicio; i < fim; i++) {
    const item = filaDia[i];
    if (!item || item.status === 'enviado') continue;
    item.ramoId = ramoId || null;
    if (ramoId) {
      const { text, idx } = pickTemplate(item.nome, ramoId);
      item.mensagem = text; item.templateIdx = idx;
    } else {
      item.mensagem = ''; item.templateIdx = -1;
    }
  }
  saveFilaDisparo();
  if (isSlot) renderFilaSlot(slot, disparoDay); else renderFila();
}

function onLoteImgChange(chipId, loteNum, input, isSlot, slot) {
  const file = input.files[0]; if (!file) return;
  // Feedback imediato: mostra "carregando..."
  const areaEl = input.previousElementSibling;
  if (areaEl && areaEl.classList.contains('fila-img-area')) {
    areaEl.innerHTML = `<span class="fila-img-label" style="color:var(--warning)">⏳ carregando imagem...</span>`;
  }
  const reader = new FileReader();
  reader.onload = e => {
    setLoteImagem(chipId, loteNum, e.target.result, file.name)
      .then(() => {
        notify('✓ Imagem do lote salva');
        if (isSlot) renderFilaSlot(slot, disparoDay); else renderFila();
      })
      .catch(err => {
        notify('// erro ao salvar imagem: ' + (err && err.message ? err.message : err), 'err');
        // mesmo com erro tenta mostrar preview em memória
        if (isSlot) renderFilaSlot(slot, disparoDay); else renderFila();
      });
  };
  reader.onerror = () => notify('// erro ao ler arquivo', 'err');
  reader.readAsDataURL(file);
}

function onLoteImgRemove(chipId, loteNum, isSlot, slot) {
  removerLoteImagem(chipId, loteNum).then(() => {
    if (isSlot) renderFilaSlot(slot, disparoDay); else renderFila();
  }).catch(() => {
    if (isSlot) renderFilaSlot(slot, disparoDay); else renderFila();
  });
}

/* ════════════════════════════
   SINCRONIZAR FILA — corrige status de itens já enviados
════════════════════════════ */
function devolverZapNaoValidadoParaValidacao() {
  const data = ensureWeekData();
  const validacao = getValData();
  const validacaoIds = new Set(validacao.map(lead => lead.id));
  const devolvidosIds = new Set();

  const devolver = (lead = {}) => {
    if (!lead.id || devolvidosIds.has(lead.id)) return;
    devolvidosIds.add(lead.id);
    if (validacaoIds.has(lead.id)) return;
    validacaoIds.add(lead.id);
    validacao.push({
      ...lead,
      canal: 'pendente',
      numStatus: 'pendente',
      status: 'Não enviada',
      diaDestino: null,
      recuperadoDaFilaZapEm: todayStr(),
    });
  };

  Object.keys(data.days || {}).forEach(day => {
    data.days[day] = (data.days[day] || []).filter(lead => {
      const aguardando = !lead.status || lead.status === 'Não enviada' || lead.status === 'Em fila';
      if (!aguardando || isLeadWhatsappValidatedForQueue(lead)) return true;
      devolver(lead);
      return false;
    });
  });

  const backlog = getZapBacklog();
  const backlogValido = backlog.filter(lead => {
    if (isLeadWhatsappValidatedForQueue(lead)) return true;
    devolver(lead);
    return false;
  });

  const filaOperacional = getWhatsappQueueV27();
  const filaOperacionalValida = filaOperacional.filter(item => {
    if (item.status === 'Enviado') return true;
    const lead = findLeadEverywhere(item.leadId) || {
      id: item.leadId,
      nome: item.nome,
      whatsapp: item.telefone
    };
    if (isLeadWhatsappValidatedForQueue(lead)) return true;
    devolver(lead);
    return false;
  });

  Object.keys(filaDisparo || {}).forEach(chipId => {
    filaDisparo[chipId] = (filaDisparo[chipId] || []).filter(item => {
      if (item.status === 'enviado' || isLeadWhatsappValidatedForQueue(item)) return true;
      devolver(item);
      return false;
    });
  });

  if (devolvidosIds.size) {
    saveWeekData(data);
    saveZapBacklog(backlogValido);
    if (filaOperacionalValida.length !== filaOperacional.length) saveWhatsappQueueV27(filaOperacionalValida);
    saveFilaDisparo();
    saveValData(validacao);
    updateBadges();
  }

  return devolvidosIds.size;
}

function sincronizarFilaComEnviados(){
  try {
    const data = typeof ensureWeekData === 'function' ? ensureWeekData() : {};
    const safe = data && typeof data === 'object' ? data : {};
    const days = safe.days && typeof safe.days === 'object' ? safe.days : {};
    const fila = typeof getWhatsappQueueV27 === 'function' ? getWhatsappQueueV27() : [];

    // Garante que a função nunca quebre se a semana vier nula do Supabase.
    const enviados = [];
    Object.values(days || {}).forEach(dayList => {
      if (!Array.isArray(dayList)) return;
      dayList.forEach(lead => {
        if (lead && (lead.status === 'enviado' || lead.whatsappStatus === 'sent')) enviados.push(lead);
      });
    });

    return { fila: Array.isArray(fila) ? fila : [], enviados };
  } catch(e) {
    console.warn('sincronizarFilaComEnviados protegido V41.7:', e?.message || e);
    return { fila: [], enviados: [] };
  }
}

function getFilaChip(chipId) {
  if (!filaDisparo[chipId]) filaDisparo[chipId] = [];
  return filaDisparo[chipId];
}

function saveFilaDisparo() {
  try { localStorage.setItem('vs_fila_disparo_v1', JSON.stringify(filaDisparo)); } catch(e) { console.warn('saveFilaDisparo error', e); }
  scheduleLegacyOperationalSyncV36();
}

const CHIP_LIMIT = 120; // máximo de leads por chip por dia

function getFilaChipNoDia(chipId, day) {
  // Retorna apenas os itens da fila do chip que pertencem ao dia informado
  const data = ensureWeekData();
  const idsNoDia = new Set((data.days[day]||[]).map(e => e.id));
  return getFilaChip(chipId).filter(f => idsNoDia.has(f.id));
}

function toggleFilaSlotEmpresa(slot, empId) {
  const chips = getChips();
  const chip = chips[slot] || null;
  if (!chip) { notify('// chip ' + (slot+1) + ' não configurado','warn'); return; }
  const fila = getFilaChip(chip.id);
  const idx = fila.findIndex(f => f.id === empId);
  const data = ensureWeekData();

  if (idx >= 0) {
    // ── REMOVER da fila ──
    fila.splice(idx, 1);
    const emOutraFila = chips.some((c, s) => s !== slot && getFilaChip(c.id).some(f => f.id === empId));
    if (!emOutraFila) {
      Object.keys(data.days).forEach(day => {
        const emp = (data.days[day]||[]).find(e => e.id === empId);
        if (emp && emp.status === 'Em fila') emp.status = 'Não enviada';
      });
      saveWeekData(data);
    }
    saveFilaDisparo();
    renderDisparoEmpresas();
    chips.forEach((_, s) => renderFilaSlot(s, disparoDay));
    updateBadges();
    return;
  }

  // ── ADICIONAR à fila ──
  const all = Object.values(data.days).flat();
  const emp = all.find(e => e.id === empId);
  if (!emp || !emp.whatsapp) { notify('// empresa sem WhatsApp','warn'); return; }
  if (!isLeadWhatsappValidatedForQueue(emp)) {
    notify('// valide o WhatsApp antes de adicionar ao chip', 'warn');
    return;
  }

  // Verificar se o chip alvo tem vaga no dia atual
  const filaChipNoDia = getFilaChipNoDia(chip.id, disparoDay);
  if (filaChipNoDia.length >= CHIP_LIMIT) {
    // Chip alvo cheio — procurar próximo chip com vaga (ordem circular a partir do slot+1)
    let slotDestino = -1;
    for (let i = 1; i <= chips.length; i++) {
      const s = (slot + i) % chips.length;
      const c = chips[s];
      if (c && getFilaChipNoDia(c.id, disparoDay).length < CHIP_LIMIT) {
        slotDestino = s;
        break;
      }
    }

    if (slotDestino === -1) {
      notify(`// todos os chips estão cheios (${CHIP_LIMIT} leads/chip) neste dia`, 'warn');
      return;
    }

    const chipDestino = chips[slotDestino];
    notify(`// Chip ${slot+1} cheio → adicionando ao Chip ${slotDestino+1} (${chipDestino.nome})`, 'warn');
    // Redireciona para o chip com vaga
    toggleFilaSlotEmpresa(slotDestino, empId);
    return;
  }

  // Chip tem vaga — adicionar normalmente
  const jaEnviado = ['Enviada','Respondida','Não respondida','Recusada','Fechada'].includes(emp.status||'');
  const filaStatus = jaEnviado ? 'enviado' : 'aguardando';
  fila.push({ id: emp.id, nome: emp.nome, site: emp.site || '', whatsapp: emp.whatsapp, mensagem: '', templateIdx: -1, ramoId: null, status: filaStatus, aberto: false });
  if (!jaEnviado) {
    Object.keys(data.days).forEach(day => {
      const e = (data.days[day]||[]).find(e => e.id === empId);
      if (e) e.status = 'Em fila';
    });
    saveWeekData(data);
  }
  saveFilaDisparo();
  renderDisparoEmpresas();
  chips.forEach((_, s) => renderFilaSlot(s, disparoDay));
  updateBadges();
}

function toggleFila(empId) {
  const chipId = disparoChipId;
  if (!chipId) { notify('// selecione um chip primeiro','warn'); return; }
  const fila = getFilaChip(chipId);
  const idx = fila.findIndex(f => f.id === empId);
  const data = ensureWeekData();
  if (idx >= 0) {
    fila.splice(idx, 1);
    Object.keys(data.days).forEach(day => {
      const emp = (data.days[day]||[]).find(e => e.id === empId);
      if (emp && emp.status === 'Em fila') emp.status = 'Não enviada';
    });
    saveWeekData(data);
  } else {
    const all  = Object.values(data.days).flat();
    const emp  = all.find(e => e.id === empId);
    if (!emp || !emp.whatsapp) return;
    if (!isLeadWhatsappValidatedForQueue(emp)) {
      notify('// valide o WhatsApp antes de adicionar ao chip', 'warn');
      return;
    }
    const jaEnviado = emp.status === 'Enviada' || emp.status === 'Respondida' || emp.status === 'Não respondida' || emp.status === 'Recusada' || emp.status === 'Fechada';
    const filaStatus = jaEnviado ? 'enviado' : 'aguardando';
    fila.push({ id: emp.id, nome: emp.nome, site: emp.site || '', whatsapp: emp.whatsapp, mensagem: '', templateIdx: -1, ramoId: null, status: filaStatus, aberto: false });
    if (!jaEnviado) {
      Object.keys(data.days).forEach(day => {
        const e = (data.days[day]||[]).find(e => e.id === empId);
        if (e) e.status = 'Em fila';
      });
      saveWeekData(data);
    }
  }
  renderDisparoEmpresas(); renderFila(); updateBadges();
}

function renderFila() {
  const countEl = document.getElementById('filaCount');
  const vaziEl  = document.getElementById('filaVazia');
  const itensEl = document.getElementById('filaItens');
  const filaAtual = getFilaChip(disparoChipId);
  countEl.textContent = `(${filaAtual.length} empresa${filaAtual.length!==1?'s':''})`;
  const vazia = filaAtual.length === 0;
  vaziEl.style.display  = vazia ? 'block' : 'none';
  itensEl.style.display = vazia ? 'none'  : 'flex';
  if (vazia) { itensEl.innerHTML = ''; return; }

  itensEl.innerHTML = filaAtual.map((item, i) => {
    const waNum = item.whatsapp.replace(/\D/g,'');
    const chip = getChipById(disparoChipId);
    const chipBadge = chip ? `<span class="q-badge ok" style="font-size:7px;margin-left:4px">📱 ${escHtml(chip.nome)}</span>` : '';
    const labels = { aguardando:'aguardando', enviando:'enviando...', enviado:'✓ enviado', erro:'✗ erro' };
    const aberto = item.aberto || false;
    return `<div class="fila-item ${item.status}" id="fila-item-${item.id}">
      <div class="fila-item-header" onclick="toggleFilaItem('${item.id}')" style="cursor:pointer;user-select:none">
        <div class="fila-item-num">${i+1}</div>
        <div class="fila-item-nome">${item.site ? `<a href="${escHtml(item.site)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none" title="${escHtml(item.site)}" onclick="event.stopPropagation()">${escHtml(item.nome)}</a>` : escHtml(item.nome)}</div>
        <div class="fila-item-wa">+${waNum}${chipBadge}</div>
        <button class="lead-drawer-open-btn" onclick="event.stopPropagation();openLeadDrawer('${item.id}')">Ficha</button>
        <div style="color:var(--muted);font-size:12px;margin-left:4px;transition:transform 0.2s;transform:rotate(${aberto?'90':'0'}deg)">▶</div>
        <button class="fila-remove-btn" style="position:static;top:auto;right:auto;width:22px;height:22px" onclick="event.stopPropagation();removerFila('${item.id}')">×</button>
      </div>
      <div class="fila-item-body" style="display:${aberto?'flex':'none'}">
        <div style="width:100%">
          <div style="font-family:'DM Mono',monospace;font-size:8px;color:var(--muted);margin-bottom:4px">① APRESENTAÇÃO</div>
          <textarea class="fila-msg-area" id="fila-msg-${item.id}" style="background:var(--surface2);border-radius:8px;padding:10px 12px;font-family:'DM Mono',monospace;font-size:9px;color:var(--text2);line-height:1.7;min-height:80px;border:1px solid var(--border2);resize:vertical;width:100%;outline:none" oninput="atualizarMsgFila('${item.id}',this.value)">${escHtml(item.mensagem)}</textarea>
          <button class="fila-msg-shuffle" onclick="shuffleFilaMsg('${item.id}')">↻ sortear</button>
        </div>
      </div>
    </div>`
  }).join('');
}

function toggleFilaItem(id) {
  const fila = getFilaChip(disparoChipId);
  const item = fila.find(f => f.id === id);
  if (!item) return;
  item.aberto = !item.aberto;
  renderFila();
}

function atualizarMsgFila(id, val) {
  const fila = getFilaChip(disparoChipId);
  const item = fila.find(f => f.id === id);
  if (item) item.mensagem = val;
}

function shuffleFilaMsgSlot(slot, id) {
  const chip = getChipBySlot(slot); if (!chip) return;
  const fila = getFilaChip(chip.id);
  const item = fila.find(f => f.id === id);
  if (!item) return;
  const itemIdx = fila.findIndex(f => f.id === id);
  const loteNum = Math.floor(itemIdx / getLoteSize()) + 1;
  const { text, idx } = pickOtherTemplate(item.nome, item.templateIdx, item.ramoId || null);
  item.mensagem = text; item.templateIdx = idx;
  const el = document.getElementById(`fila-msg-${slot}-${id}`);
  if (el) el.value = item.mensagem;
  saveFilaDisparo();
}
function shuffleFilaMsg(id) {
  const fila = getFilaChip(disparoChipId);
  const item = fila.find(f => f.id === id);
  if (!item) return;
  const itemIdx = fila.findIndex(f => f.id === id);
  const loteNum = Math.floor(itemIdx / getLoteSize()) + 1;
  const { text, idx } = pickOtherTemplate(item.nome, item.templateIdx, item.ramoId || null);
  item.mensagem = text; item.templateIdx = idx;
  const el = document.getElementById(`fila-msg-${id}`);
  if (el) el.value = item.mensagem;
}
function onRamoFilaChange(id, ramoId) {
  const fila = getFilaChip(disparoChipId);
  const item = fila.find(f => f.id === id);
  if (!item) return;
  item.ramoId = ramoId || null;
  saveFilaDisparo();
  // Sortear automaticamente com o novo ramo
  const { text, idx } = pickTemplate(item.nome, item.ramoId);
  item.mensagem = text; item.templateIdx = idx;
  saveFilaDisparo();
  const el = document.getElementById(`fila-msg-${id}`);
  if (el) el.value = item.mensagem;
}
function onImgChange(id, input, slot) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const fila = getFilaChip(disparoChipId);
    const item = fila.find(f => f.id === id);
    if (!item) return;
    if (slot === '2') {
      item.imagem2Base64 = e.target.result; item.imagem2Nome = file.name;
    } else {
      item.imagemBase64 = e.target.result; item.imagemNome = file.name;
    }
    renderFila();
  };
  reader.readAsDataURL(file);
}
function removerImagem(id, slot) {
  const fila = getFilaChip(disparoChipId);
  const item = fila.find(f => f.id === id);
  if (!item) return;
  if (slot === '2') {
    delete item.imagem2Base64; delete item.imagem2Nome;
  } else {
    delete item.imagemBase64; delete item.imagemNome;
  }
  renderFila();
}
function removerFila(id) {
  if (!filaDisparo[disparoChipId]) return;
  const item = filaDisparo[disparoChipId].find(f => f.id === id);
  abrirModalConfirm(
    `Remover <strong>${item ? escHtml(item.nome) : 'esta empresa'}</strong> da fila?`,
    () => {
      if (!filaDisparo[disparoChipId]) return;
      filaDisparo[disparoChipId] = filaDisparo[disparoChipId].filter(f => f.id !== id);
      const data = ensureWeekData();
      Object.keys(data.days).forEach(day => {
        const emp = (data.days[day]||[]).find(e => e.id === id);
        if (emp && emp.status === 'Em fila') emp.status = 'Não enviada';
      });
      saveWeekData(data); saveFilaDisparo(); updateBadges(); renderDisparoEmpresas(); renderFila();
    }
  );
}
function limparFila() {
  if (disparoEmAndamento) { notify('// disparo em andamento','warn'); return; }
  if (aguardandoLote) cancelarLotes();
  const chipId = disparoChipId;
  if (chipId && filaDisparo[chipId]) {
    const data = ensureWeekData();
    Object.keys(data.days).forEach(day => {
      (data.days[day]||[]).forEach(emp => { if (emp.status === 'Em fila') emp.status = 'Não enviada'; });
    });
    saveWeekData(data);
    filaDisparo[chipId] = [];
  }
  updateBadges(); renderDisparoEmpresas(); renderFila();
}

/* ════════════════════════════
   HORÁRIO AUTOMÁTICO
════════════════════════════ */
let horarioJaDisparado = false;
let horarioUltimoDisparo = '';

function checkHorarioDisparo(now) {
  const cfg = loadEvoConfig() || {};
  if (!cfg.horarioInicio) return;
  const [hh, mm] = cfg.horarioInicio.split(':').map(Number);
  const nowH = now.getHours(), nowM = now.getMinutes();
  const key = `${todayStr()}_${cfg.horarioInicio}`;
  const slotsProntos = getChips()
    .map((chip, slot) => ({ chip, slot, st: chipSlotState[slot] }))
    .filter(({ chip, st }) =>
      st &&
      !st.disparoEmAndamento &&
      !st.aguardandoLote &&
      getFilaChip(chip.id).some(item => item.status === 'aguardando')
    );

  if (nowH === hh && nowM === mm && horarioUltimoDisparo !== key && slotsProntos.length) {
    horarioUltimoDisparo = key;
    notify(`⏰ Disparo automático iniciado — ${cfg.horarioInicio}`);
    slotsProntos.forEach(({ slot }) => {
      iniciarDisparoChip(slot).catch(e => notify(`// falha no disparo automático: ${e.message}`, 'err'));
    });
  }
  const el = document.getElementById('horarioStatus');
  if (el) {
    el.textContent = `próximo: ${cfg.horarioInicio}`;
    el.className = 'horario-status' + (chipSlotState.some(st => st.disparoEmAndamento || st.aguardandoLote) ? ' ativo' : '');
  }
  const el2 = document.getElementById('horarioStatusInline');
  if (el2) el2.textContent = cfg.horarioInicio || '--:--';
}

/* ════════════════════════════
   EVO CONFIG
════════════════════════════ */
function loadEvoConfig(){
  const defaults = {
    horarioInicio: '08:00',
    delayMin: 120,
    delayMax: 120,
    loteTamanho: 30,
    loteEsperaMin: 60,
    loteAtivo: 1
  };

  try {
    const raw =
      localStorage.getItem('vs_evo_config') ||
      localStorage.getItem('evo_config') ||
      localStorage.getItem('vs_disparo_config') ||
      localStorage.getItem('disparoConfig') ||
      '{}';

    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...(parsed && typeof parsed === 'object' ? parsed : {})
    };
  } catch {
    return defaults;
  }
}

function saveEvoConfig() {
  const cfg = {
    delayMin: document.getElementById('delayMin')?.value,
    delayMax: document.getElementById('delayMax')?.value,
    loteTamanho: document.getElementById('loteTamanho')?.value,
    loteEsperaMin: document.getElementById('loteEsperaMin')?.value,
    horarioInicio: document.getElementById('horarioInicio')?.value,
  };
  localStorage.setItem(EVO_KEY, JSON.stringify(cfg));
  scheduleLegacyOperationalSyncV36();
  if (typeof atualizarStatsDisparo === 'function') atualizarStatsDisparo();
}
function toggleLoteConfig() {
  const fields = document.getElementById('loteConfigFields');
  if (fields) fields.style.display = document.getElementById('loteAtivo').checked ? 'flex' : 'none';
}

/* ════════════════════════════
   DISPARO — LOTES
════════════════════════════ */
function getLoteSize() {
  return Math.max(30, parseInt(document.getElementById('loteTamanho')?.value) || 30);
}
function getLoteConfig() {
  const tam = Math.max(30, parseInt(document.getElementById('loteTamanho')?.value)||30);
  const esp = Math.max(60, parseInt(document.getElementById('loteEsperaMin')?.value)||60);
  return { ativo: document.getElementById('loteAtivo')?.checked||false, tamanho: tam, esperaMin: esp };
}

function cancelarLotes() {
  if (loteEsperaTimer)  { clearTimeout(loteEsperaTimer);  loteEsperaTimer = null; }
  if (loteCountdownInt) { clearInterval(loteCountdownInt); loteCountdownInt = null; }
  filaLotes = []; loteAtual = 0; lotesTotal = 0; aguardandoLote = false; loteEsperaFim = null;
  document.getElementById('loteEsperaPanel').style.display = 'none';
  notify('// fila cancelada','warn');
}

function iniciarCountdownLote(msRestante) {
  const btnProx = document.getElementById('btnProximoLote');
  const countEl = document.getElementById('loteCountdown');
  const barEl   = document.getElementById('loteProgressBar');
  const duracaoMs = msRestante;
  if (loteCountdownInt) clearInterval(loteCountdownInt);
  function tick() {
    const restante = loteEsperaFim - Date.now();
    if (restante <= 0) { clearInterval(loteCountdownInt); loteCountdownInt=null; countEl.textContent='00:00'; barEl.style.width='100%'; btnProx.disabled=false; btnProx.style.background='var(--accent)'; notify('✓ Lote liberado!'); return; }
    const min = Math.floor(restante/60000), seg = Math.floor((restante%60000)/1000);
    countEl.textContent = `${String(min).padStart(2,'0')}:${String(seg).padStart(2,'0')}`;
    barEl.style.width = Math.min(100, ((duracaoMs-restante)/duracaoMs)*100) + '%';
  }
  tick(); loteCountdownInt = setInterval(tick, 500);
  loteEsperaTimer = setTimeout(() => { loteEsperaTimer = null; }, msRestante);
}

async function confirmarProximoLote() {
  if (!filaLotes.length) return;
  document.getElementById('btnProximoLote').disabled = true;
  document.getElementById('loteEsperaPanel').style.display = 'none';
  if (loteCountdownInt) { clearInterval(loteCountdownInt); loteCountdownInt = null; }
  if (loteEsperaTimer)  { clearTimeout(loteEsperaTimer);  loteEsperaTimer = null; }
  await dispararLote();
}

async function dispararLote() {
  loteAtual++;
  const lote     = filaLotes.shift();
  const loteConf = getLoteConfig();
  const chip     = getChipById(disparoChipId);
  if (!chip) { notify('// configure um chip primeiro','err'); return; }
  const delayMin = parseInt((document.getElementById('delayMin')||{}).value)||120;
  const delayMax = parseInt((document.getElementById('delayMax')||{}).value)||180;
  const MSG_DELAY = 15000; // 15s entre mensagens da mesma empresa
  const logEl    = document.getElementById('disparoLog');
  logEl.style.display = 'block';
  disparoEmAndamento = true;
  document.getElementById('btnDisparar').disabled = true;
  document.getElementById('disparoSpinner').style.display = 'block';
  document.getElementById('disparoBtn').textContent = `Lote ${loteAtual}/${lotesTotal}...`;

  function log(msg) { const l = document.createElement('div'); l.style.marginBottom='3px'; l.innerHTML=`<span style="color:var(--muted)">[${timeStr()}]</span> ${msg}`; logEl.appendChild(l); logEl.scrollTop=logEl.scrollHeight; }
  log(`<span style="color:var(--accent)">━━ LOTE ${loteAtual}/${lotesTotal} · ${lote.length} empresa${lote.length>1?'s':''} ━━</span>`);

  for (let i = 0; i < lote.length; i++) {
    const item = lote[i];
    if (item.status === 'enviado') continue;
    item.status = 'enviando'; atualizarStatusFila(item.id,'enviando');
    log(`Enviando para <span style="color:var(--text)">${escHtml(item.nome)}</span>...`);
    try {
      const waNum  = item.whatsapp.replace(/\D/g,'');
      const numero = waNum.startsWith('55') ? waNum : '55' + waNum;

      // MSG 1 — Apresentação
      const payload1 = { number: numero, options: { delay: 1000 }, textMessage: { text: item.mensagem } };
      const res1 = await fetch(`${chip.url}/message/sendText/${chip.instance}`, { method:'POST', headers:{'Content-Type':'application/json','apikey':chip.key}, body: JSON.stringify(payload1) });
      if (!res1.ok) throw new Error(`HTTP ${res1.status}`);
      log(`  ① apresentação enviada`);
      await new Promise(r => setTimeout(r, MSG_DELAY));

      // MSG 2 — Imagem redesign (item ou padrão do lote)
      const loteNumSend = loteAtual;
      const imgRedesign = item.imagem2Base64 || getLoteImagem(disparoChipId, loteNumSend);
      if (imgRedesign) {
        await new Promise(r => setTimeout(r, MSG_DELAY));
        const b2 = imgRedesign.split(',')[1], m2 = imgRedesign.split(';')[0].split(':')[1] || 'image/jpeg';
        const payload3 = { number: numero, options: { delay: 1000 }, mediaMessage: { mediatype: 'image', media: b2, mimetype: m2, caption: '' } };
        await fetch(`${chip.url}/message/sendMedia/${chip.instance}`, { method:'POST', headers:{'Content-Type':'application/json','apikey':chip.key}, body: JSON.stringify(payload3) });
        log(`  ② imagem (redesign) enviada`);
      } else {
        log(`  ② <span style="color:var(--warning)">sem imagem (configure no cabeçalho do lote)</span>`);
      }

      item.status='enviado'; atualizarStatusFila(item.id,'enviado');
      log(`<span style="color:var(--accent)">✓ ${escHtml(item.nome)}</span>`);
      atualizarStatusEmpresa(item.id,'Enviada');
    } catch(e) {
      item.status='erro'; atualizarStatusFila(item.id,'erro');
      log(`<span style="color:var(--error)">✗ Erro — ${e.message}</span>`);
    }
    if (i < lote.length-1) {
      const delay = (delayMin + Math.random()*(delayMax-delayMin))*1000;
      log(`Aguardando ${Math.round(delay/1000)}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  const env = lote.filter(f=>f.status==='enviado').length, erros = lote.filter(f=>f.status==='erro').length;
  log(`<span style="color:var(--accent)">✓ Lote ${loteAtual} concluído! ${env} enviado${env>1?'s':''} · ${erros} erro${erros>1?'s':''}</span>`);
  disparoEmAndamento = false;
  document.getElementById('disparoSpinner').style.display = 'none';
  renderFilaZap(); renderInicio();

  if (filaLotes.length > 0) {
    const esperaMs = loteConf.esperaMin*60*1000; loteEsperaFim = Date.now()+esperaMs; aguardandoLote = true;
    document.getElementById('btnDisparar').disabled = true;
    document.getElementById('disparoBtn').textContent = `🟡 Aguardando lote ${loteAtual+1}/${lotesTotal}`;
    const panel = document.getElementById('loteEsperaPanel'); panel.style.display='block';
    document.getElementById('loteEsperaTitle').textContent = `⏱ Aguardando lote ${loteAtual+1}/${lotesTotal}...`;
    document.getElementById('btnProximoLote').disabled=true; document.getElementById('btnProximoLote').style.background='var(--surface3)';
    document.getElementById('loteProgressBar').style.width='0%';
    notify(`✓ Lote ${loteAtual} concluído · próximo em ${loteConf.esperaMin}min`);
    iniciarCountdownLote(esperaMs);
  } else {
    aguardandoLote=false; document.getElementById('btnDisparar').disabled=false; document.getElementById('disparoBtn').textContent='🟢 Disparar fila';
    const filaAtual = getFilaChip(disparoChipId);
    const totalEnv = filaAtual.filter(f=>f.status==='enviado').length;
    const totalErr = filaAtual.filter(f=>f.status==='erro').length;
    log(`<span style="color:var(--accent)">━━ CONCLUÍDO · ${totalEnv} enviados · ${totalErr} erros ━━</span>`);
    notify(`✓ ${lotesTotal} lote${lotesTotal>1?'s':''} concluído${lotesTotal>1?'s':''} · ${totalEnv} enviados`);
  }
}

async function iniciarDisparo() {
  if (disparoEmAndamento || aguardandoLote) return;
  const chip = getChipById(disparoChipId);
  if (!chip) { notify('// configure um chip primeiro','err'); return; }
  const filaAtual = getFilaChip(disparoChipId);
  if (!filaAtual.length) { notify('// fila vazia','warn'); return; }
  document.getElementById('disparoLog').innerHTML = '';
  const loteConf = getLoteConfig();
  if (loteConf.ativo && filaAtual.length > loteConf.tamanho) {
    filaLotes=[]; loteAtual=0;
    for (let i=0; i<filaAtual.length; i+=loteConf.tamanho) filaLotes.push(filaAtual.slice(i,i+loteConf.tamanho));
    lotesTotal=filaLotes.length;
    await dispararLote();
  } else {
    filaLotes=[]; loteAtual=1; lotesTotal=1; filaLotes.push([...filaAtual]);
    await dispararLote();
  }
}

function atualizarStatusFila(id, status) {
  const el = document.getElementById(`fila-item-${id}`); if (!el) return;
  el.className = `fila-item ${status}`;
  const st = el.querySelector('.fila-item-status'); if (!st) return;
  const labels = { aguardando:'aguardando', enviando:'enviando...', enviado:'✓ enviado', erro:'✗ erro' };
  st.className=`fila-item-status ${status}`; st.textContent=labels[status]||status;
}
function atualizarStatusEmpresa(id, novoStatus) {
  const data = ensureWeekData();
  Object.keys(data.days).forEach(day => {
    const idx = data.days[day].findIndex(e => e.id===id);
    if (idx>=0) { data.days[day][idx].status=novoStatus; data.days[day][idx].enviadoEm=todayStr(); }
  });
  saveWeekData(data); updateBadges();
}

