import { db, auth } from '../firebase-init.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { h, toast } from '../ui.js';
import { bumpClubStats } from '../stats.js';
import { state } from '../app.js';

export async function renderLogRun(view) {
  view.innerHTML = '';
  // clubs I'm an active member of — state.roles is { clubId: clubName }
  const clubSel = h('select', {}, h('option', { value: '' }, 'Solo run (no club)'),
    Object.entries(state.roles).map(([id, name]) => h('option', { value: id }, name)));

  const km = h('input', { type: 'number', step: '0.01', min: '0.1', placeholder: 'e.g. 8.5' });
  const mins = h('input', { type: 'number', min: '1', placeholder: 'e.g. 45' });
  const date = h('input', { type: 'date',
    value: new Date().toISOString().slice(0, 10) });
  const err = h('div', { class: 'error' });
  const save = h('button', { class: 'btn' }, 'Save run');

  save.onclick = async () => {
    const d = parseFloat(km.value), m = parseInt(mins.value, 10);
    if (!d || !m) { err.textContent = 'Enter distance and duration.'; return; }
    save.disabled = true;
    await addDoc(collection(db, 'activities'), {
      userId: auth.currentUser.uid,
      clubId: clubSel.value || null,
      distanceM: d * 1000, durationS: m * 60,
      startedAt: new Date(date.value + 'T07:00:00'),
      source: 'manual', verified: false,
      createdAt: serverTimestamp(),
    });
    if (clubSel.value) await bumpClubStats(clubSel.value, d * 1000);
    toast('Run saved! 🏃');
    location.hash = '#/profile';
  };

  view.append(h('h1', {}, 'Log a run'),
    h('p', { class: 'muted', style: 'margin-bottom:18px' },
      'Manual logging. For league scoring use 🏃 GPS Track.'),
    h('label', { class: 'field' }, h('span', {}, 'Club'), clubSel),
    h('div', { class: 'row' },
      h('label', { class: 'field', style: 'flex:1' }, h('span', {}, 'Distance (km)'), km),
      h('label', { class: 'field', style: 'flex:1' }, h('span', {}, 'Duration (min)'), mins)),
    h('label', { class: 'field' }, h('span', {}, 'Date'), date),
    err, save);
}
