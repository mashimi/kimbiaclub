import { db, auth } from '../firebase-init.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { h, toast, Fmt } from '../ui.js';
import { bumpClubStats } from '../stats.js';
import { state } from '../app.js';

const hav = (a, b) => {
  const R = 6371000, rad = (x) => x * Math.PI / 180;
  const dLa = rad(b.lat - a.lat), dLo = rad(b.lng - a.lng);
  const s = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

export function renderTrack(view) {
  view.innerHTML = '';
  if (!('geolocation' in navigator)) {
    view.append(h('p', { class: 'error' }, 'This browser has no GPS support.'));
    return;
  }

  let watch = null, started = null, pausedAt = null, pausedTotal = 0;
  let points = [], dist = 0, running = false, clubId = null;

  const dEl = h('b', {}, '0.00'), tEl = h('b', {}, '00:00:00'), pEl = h('b', {}, '--');
  const ctrlRow = h('div', { class: 'row', style: 'margin-top:18px' });
  const timer = setInterval(() => {
    if (!started) return;
    const elapsed = ((running ? Date.now() : pausedAt) - started - pausedTotal) / 1000;
    tEl.textContent = Fmt.dur(elapsed);
    pEl.textContent = dist > 30 && elapsed > 0 ? Fmt.pace(elapsed / (dist / 1000)) : '--';
  }, 1000);

  const paint = () => {
    dEl.textContent = (dist / 1000).toFixed(2);
    ctrlRow.innerHTML = '';
    if (!running && !started) {
      ctrlRow.append(h('button', { class: 'btn', onclick: start }, '▶ START RUN'));
    } else {
      ctrlRow.append(
        h('button', { class: 'btn secondary', onclick: () => running ? pause() : resume() },
          running ? '⏸ Pause' : '▶ Resume'),
        h('button', { class: 'btn danger', onclick: finish }, '■ Finish'));
    }
  };

  function start() {
    navigator.geolocation.getCurrentPosition((p) => {
      watch = navigator.geolocation.watchPosition((pos) => {
        if (!running) return;
        const np = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: Date.now() };
        const last = points[points.length - 1];
        if (last) {
          const seg = hav(last, np);
          if (seg > 90) return;           // impossible jump — ignore
          dist += seg;
        }
        points.push(np);
      }, (e) => toast('GPS: ' + e.message), { enableHighAccuracy: true, maximumAge: 2000 });
      started = Date.now(); running = true;
      toast('Tracking… keep this tab open');
      paint();
    }, () => toast('Location permission denied'), { enableHighAccuracy: true });
  }
  function pause() { running = false; pausedAt = Date.now(); paint(); }
  function resume() { pausedTotal += Date.now() - pausedAt; running = true; paint(); }

  async function finish() {
    if (watch) navigator.geolocation.clearWatch(watch);
    clearInterval(timer);
    const elapsed = ((running ? Date.now() : pausedAt) - started - pausedTotal) / 1000;
    if (dist < 50) { toast('Run too short to save'); location.hash = '#/home'; return; }
    // decimate to ~300 points
    const step = Math.max(1, Math.ceil(points.length / 300));
    const pts = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    await addDoc(collection(db, 'activities'), {
      userId: auth.currentUser.uid, clubId,
      distanceM: Math.round(dist), durationS: Math.round(elapsed),
      startedAt: new Date(started),
      points: pts, source: 'gps', verified: false,   // league reads source==='gps'
      createdAt: serverTimestamp(),
    });
    if (clubId) await bumpClubStats(clubId, Math.round(dist));
    toast(`Saved ${(dist / 1000).toFixed(2)} km ✅ (counts for the league!)`);
    location.hash = '#/profile';
  }

  // optional club tagging — state.roles is { clubId: clubName }
  const clubSel = h('select', {}, h('option', { value: '' }, 'Solo run'),
    Object.entries(state.roles).map(([id]) => h('option', { value: id }, 'Tag club run')));
  clubSel.onchange = () => { clubId = clubSel.value || null; };

  view.append(
    h('h1', {}, 'Track run'),
    h('p', { class: 'muted', style: 'margin-bottom:14px' },
      'GPS-tracked runs are ✅ verified and count for Club of the Month.'),
    h('label', { class: 'field' }, h('span', {}, 'Tag to club (optional)'), clubSel),
    h('div', { style: 'background:var(--surface);border:1px solid var(--outline);border-radius:22px;padding:26px;text-align:center' },
      h('div', {}, h('b', { class: 'stat-num', style: 'font-size:44px' }, dEl),
        h('small', { class: 'muted' }, ' KM')),
      h('div', { class: 'row', style: 'justify-content:center;margin-top:14px' },
        h('div', { style: 'flex:1' }, tEl, h('small', { class: 'muted' }, ' TIME')),
        h('div', { style: 'flex:1' }, pEl, h('small', { class: 'muted' }, ' PACE /KM'))),
      ctrlRow));
  paint();
}
