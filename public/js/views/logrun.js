import { db, auth } from '../firebase-init.js';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { h, toast } from '../ui.js';
import { bumpClubStats } from '../stats.js';
import { state } from '../app.js';

export async function renderLogRun(view) {
  view.innerHTML = '';
  
  const clubSel = h('select', {}, h('option', { value: '' }, '👤 Solo run (no club)'));

  async function loadClubOptions() {
    clubSel.innerHTML = '';
    clubSel.append(h('option', { value: '' }, '👤 Solo run (no club)'));

    const userRoles = state.roles || {};
    const userClubIds = Object.keys(userRoles);

    if (userClubIds.length > 0) {
      const myGroup = h('optgroup', { label: '⭐ My Joined Clubs' });
      for (const [id, name] of Object.entries(userRoles)) {
        myGroup.append(h('option', { value: id }, `🏃 ${name}`));
      }
      clubSel.append(myGroup);
      clubSel.value = userClubIds[0];
    }

    try {
      const snap = await getDocs(collection(db, 'clubs'));
      if (!snap.empty) {
        const otherGroup = h('optgroup', { label: userClubIds.length > 0 ? 'Other Clubs' : 'All Running Clubs' });
        snap.forEach((d) => {
          if (!userRoles[d.id]) {
            const data = d.data();
            otherGroup.append(h('option', { value: d.id }, `🏃 ${data.name || 'Club'} (${data.city || 'Tanzania'})`));
          }
        });
        if (otherGroup.children.length > 0) {
          clubSel.append(otherGroup);
        }
      }
    } catch (e) {
      console.warn('Error loading clubs for logrun:', e);
    }
  }

  loadClubOptions();

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
