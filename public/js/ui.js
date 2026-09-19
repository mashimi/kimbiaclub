export const $ = (s) => document.querySelector(s);

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(9)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(c));
  }
  return el;
}

export function toast(msg, ms = 2800) {
  const t = h('div', { class: 'toast' }, msg);
  $('#toast-root').append(t);
  setTimeout(() => t.remove(), ms);
}

export function openModal(build) {
  const root = $('#modal-root');
  const overlay = h('div', { class: 'overlay' });
  const sheet = h('div', { class: 'sheet' });
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  build(sheet, close);
  sheet.append(h('div', { class: 'row', style: 'margin-top:16px' },
    h('button', { class: 'btn secondary', onclick: close }, 'Close')));
  overlay.append(sheet);
  root.append(overlay);
  return close;
}

export function spinner(text = 'Loading…') {
  return h('div', { class: 'boot' }, text);
}

export const Fmt = {
  km(m) {
    if (!m || m < 9.5) return `${Math.round(m || 0)} m`;
    return `${(m / 1000).toFixed(m < 9950 ? 2 : 1)} km`;
  },
  pace(secPerKm) {
    if (!secPerKm || !isFinite(secPerKm) || secPerKm <= 0) return '--';
    const s = Math.round(secPerKm);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },
  dur(s) {
    s = Math.round(s || 0);
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    return [hh, mm, ss].map((n) => String(n).padStart(2, '0')).join(':');
  },
  tzs(n) {
    return 'TSh ' + String(n || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },
  date(d) { return d instanceof Date ? `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}` : '—'; },
  dt(d) {
    if (!(d instanceof Date)) return '—';
    const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${Fmt.date(d)} ${t}`;
  },
  ago(d) {
    if (!d) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return Fmt.date(d);
  },
};

export function monthKey(offsetMonths = -1) {
  const d = new Date();
  d.setDate(1); d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const TZ_CITIES = ['Dar es Salaam', 'Arusha', 'Dodoma', 'Mwanza', 'Mbeya',
  'Zanzibar', 'Tanga', 'Moshi', 'Morogoro', 'Other'];
