import { db, auth } from '../firebase-init.js';
import { doc, updateDoc } from 'firebase/firestore';
import { h, TZ_CITIES } from '../ui.js';
import { state } from '../app.js';

export function renderSetup(view) {
  view.innerHTML = '';
  const name = h('input', { value: state.profile?.displayName || '', placeholder: 'Your name' });
  const city = h('select', {}, TZ_CITIES.map((c) =>
    h('option', { value: c, selected: state.profile?.homeCity === c || null }, c)));
  const save = h('button', { class: 'btn' }, 'Start running 🏃');
  save.onclick = async () => {
    if (!name.value.trim()) return;
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      displayName: name.value.trim(), homeCity: city.value,
    });
    state.profile = { ...state.profile, displayName: name.value.trim(), homeCity: city.value };
    location.hash = '#/home';
  };
  view.append(h('div', { style: 'max-width:380px;margin:10vh auto 0' },
    h('h1', {}, 'Karibu! 👋'), h('p', { class: 'muted' }, 'Set up your runner profile'),
    h('div', { style: 'margin-top:24px' },
      h('label', { class: 'field' }, h('span', {}, 'Name'), name),
      h('label', { class: 'field' }, h('span', {}, 'Home city'), city), save)));
}
