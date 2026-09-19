import { db, auth } from '../firebase-init.js';
import { collection, collectionGroup, doc, onSnapshot, query, where, orderBy, limit,
  getDocs, getDoc, updateDoc } from 'firebase/firestore';
import { h, Fmt, toast, openModal, TZ_CITIES } from '../ui.js';
import { state } from '../app.js';

export function renderProfile(view) {
  view.innerHTML = '';
  const uid = auth.currentUser.uid;
  const p = state.profile;

  view.append(
    h('div', { class: 'spread' },
      h('div', { class: 'row' },
        h('div', { class: 'av', style: 'width:52px;height:52px;font-size:24px;font-weight:900;color:var(--lime);background:var(--surface-hi);border-radius:50%;display:flex;align-items:center;justify-content:center' },
          (p.displayName || 'R')[0].toUpperCase()),
        h('div', {},
          h('b', { style: 'font-size:19px' }, p.displayName),
          h('div', { class: 'muted', style: 'font-size:13px' }, `${p.homeCity} · ${auth.currentUser.phoneNumber}`))),
      h('button', { class: 'btn secondary small', onclick: editProfile }, '✏️')),

    h('div', { id: 'stats', style: 'margin-top:16px' }),
    h('h2', {}, 'My runs'), h('div', { id: 'runs' }),

    h('h2', {}, 'More'),
    h('div', { class: 'tile', onclick: () => { location.hash = '#/import'; } },
      h('div', { class: 'av' }, '⏪'),
      h('div', { class: 'grow' }, h('b', {}, 'Import Google Timeline'),
        h('small', {}, 'Backfill your history — processed on your device')),
      h('span', { class: 'faint' }, '›')),
    h('div', { class: 'tile', onclick: () => { location.hash = '#/create-club'; } },
      h('div', { class: 'av' }, '➕'),
      h('div', { class: 'grow' }, h('b', {}, 'Register a club'),
        h('small', {}, 'Start your own club on Kimbia')),
      h('span', { class: 'faint' }, '›')),

    h('h2', {}, 'Clubs you own/admin'), h('div', { id: 'adminclubs' }),
    h('h2', {}, 'Clubs you joined'), h('div', { id: 'joinedclubs' }),

    h('button', { class: 'btn danger', style: 'margin-top:24px', onclick: async () => {
      await auth.signOut(); location.hash = '#/home';
    } }, 'Sign out'),
    h('p', { class: 'faint', style: 'text-align:center;font-size:11px;margin-top:24px' },
      'Kimbia TZ v1.0 · Made for Tanzanian runners 🇹🇿'));

  // stats + runs
  onSnapshot(query(collection(db, 'activities'), where('userId', '==', uid),
    orderBy('startedAt', 'desc'), limit(300)), (snap) => {
    const docs = snap.docs.map((d) => d.data());
    let totalM = 0, weekM = 0, weekN = 0;
    const weekAgo = Date.now() - 7 * 864e5;
    for (const a of docs) {
      totalM += a.distanceM || 0;
      const at = a.startedAt?.toMillis?.() ?? 0;
      if (at > weekAgo) { weekM += a.distanceM || 0; weekN++; }
    }
    const el = view.querySelector('#stats');
    el.innerHTML = '';
    el.className = 'row';
    [[String(docs.length), 'RUNS'], [Fmt.km(totalM), 'TOTAL'],
     [`${weekN} · ${Fmt.km(weekM)}`, 'THIS WEEK']].forEach(([v, l]) => {
      el.append(h('div', { class: 'bigstat', style: 'flex:1;background:var(--surface);border:1px solid var(--outline);border-radius:16px' },
        h('b', { class: 'stat-num', style: 'font-size:16px' }, v),
        h('small', { class: 'muted' }, l)));
    });
    const rl = view.querySelector('#runs'); rl.innerHTML = '';
    if (!docs.length) rl.append(h('p', { class: 'muted' }, 'No runs yet — hit 🏃 Track!'));
    docs.slice(0, 20).forEach((a) => {
      const secs = a.durationS && a.distanceM ? a.durationS / (a.distanceM / 1000) : 0;
      rl.append(h('div', { class: 'tile' },
        h('div', { class: 'av' }, (a.verified || a.source === 'gps') ? '✅' : '🏃'),
        h('div', { class: 'grow' },
          h('b', {}, `${Fmt.km(a.distanceM)} · ${Fmt.dur(a.durationS)} · ${Fmt.pace(secs)} /km`),
          h('small', {}, `${Fmt.dt(a.startedAt?.toDate?.())} · ${a.source}`))));
    });
  });

  onSnapshot(query(collection(db, 'clubs'), where('ownerId', '==', uid)), (snap) => {
    const el = view.querySelector('#adminclubs'); el.innerHTML = '';
    snap.forEach((d) => el.append(h('div', { class: 'tile',
      onclick: () => { location.hash = `#/admin/${d.id}`; } },
      h('div', { class: 'av' }, '⚙️'),
      h('div', { class: 'grow' }, h('b', {}, d.data().name),
        h('small', {}, `${d.data().memberCount ?? 0} members`)),
      h('span', { class: 'faint' }, '›'))));
  });

  getDocs(query(collectionGroup(db, 'members'),
    where('userId', '==', uid), where('status', '==', 'active'))).then(async (snap) => {
    const el = view.querySelector('#joinedclubs'); el.innerHTML = '';
    for (const m of snap.docs) {
      const clubId = m.ref.parent.parent.id;
      const c = await getDoc(doc(db, 'clubs', clubId));
      el.append(h('div', { class: 'tile', onclick: () => { location.hash = `#/clubs/${clubId}`; } },
        h('div', { class: 'av' }, '🏃'),
        h('div', { class: 'grow' }, h('b', {}, c.data()?.name || 'Club')),
        h('span', { class: 'faint' }, '›')));
    }
  });

  function editProfile() {
    openModal((sheet, close) => {
      const name = h('input', { value: p.displayName });
      const city = h('select', {}, TZ_CITIES.map((c) =>
        h('option', { value: c, selected: p.homeCity === c || null }, c)));
      sheet.append(h('h3', {}, 'Edit profile'),
        h('label', { class: 'field' }, h('span', {}, 'Name'), name),
        h('label', { class: 'field' }, h('span', {}, 'City'), city),
        h('button', { class: 'btn', onclick: async () => {
          await updateDoc(doc(db, 'users', uid),
            { displayName: name.value.trim(), homeCity: city.value });
          state.profile = { ...p, displayName: name.value.trim(), homeCity: city.value };
          close(); location.hash = '#/profile';
        } }, 'Save'));
    });
  }
}
