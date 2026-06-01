/* ════════════════════════════
   EXTRACT HELPERS
════════════════════════════ */
function extractSite(item) { return String(item.website || item.url || item.site || '').trim(); }
function extractPhone(item) { return String(item.phone || item.whatsapp || item.phoneNumber || item.telefone || '').trim(); }
function extractName(item)  { return capitalizeName(String(item.title || item.name || item.nome || '').trim()); }
function extractInstagram(item) {
  const ig = String(item.instagram || item.instagramUrl || item.instagram_url || '').trim();
  if (ig) return ig;
  const socials = item.socialMedia || item.profiles || item.social || [];
  if (Array.isArray(socials)) {
    const found = socials.find(s => {
      const url = String(s.url || s.link || s.href || '').toLowerCase();
      return url.includes('instagram.com');
    });
    if (found) return String(found.url || found.link || found.href || '').trim();
  }
  return '';
}
function extractCategory(item) {
  return String(item.categoryName || item.category || item.categoria || item.type || '').trim();
}
function extractGoogleUrl(item) {
  return String(item.url || item.googleUrl || item.google_url || item.maps_url || item.link || '').trim();
}
function hasValidSiteRaw(item) {
  const site = String(item.website || item.url || item.site || '').trim();
  return site.startsWith('http') && site.length > 8;
}
function hasValidPhone(item) {
  return normalizePhone(extractPhone(item)).length >= 10;
}

/* ════════════════════════════
   RAMO FILTER
════════════════════════════ */
let activeRamoId = null;

function getRamoKeywords() {
  if (!activeRamoId) return null;
  const ramo = getRamos().find(r => r.id === activeRamoId);
  return ramo ? ramo.keywords : null;
}

function isRamoMatch(item) {
  const kws = getRamoKeywords();
  if (!kws) return true; // sem ramo selecionado: passa tudo
  const cat = normalizeStr(extractCategory(item));
  return kws.some(kw => cat.includes(normalizeStr(kw)));
}

function onRamoChange() {
  activeRamoId = document.getElementById('ramoSelect').value || null;
  const ramo = activeRamoId ? getRamos().find(r => r.id === activeRamoId) : null;
  const wrap = document.getElementById('subRamosWrap');
  const list = document.getElementById('subRamosList');
  if (ramo) {
    wrap.style.display = 'block';
    list.innerHTML = ramo.keywords.map(k =>
      `<span style="background:var(--accent-dim);border:1px solid var(--accent-border);color:var(--accent);font-family:'DM Mono',monospace;font-size:8px;padding:2px 8px;border-radius:100px">${escHtml(k)}</span>`
    ).join('');
  } else {
    wrap.style.display = 'none';
    list.innerHTML = '';
  }
  importPreview();
}

function renderRamoSelect() {
  const sel = document.getElementById('ramoSelect');
  const ramos = getRamos();
  sel.innerHTML = '<option value="">Selecionar ramo...</option>' +
    ramos.map(r => `<option value="${r.id}"${activeRamoId===r.id?' selected':''}>${escHtml(r.nome)}</option>`).join('');
}

