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
        h('img', {
          src: p.photoURL || '/assets/avatar.png',
          alt: 'Athlete Profile',
          style: 'width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid var(--green);box-shadow:0 0 14px rgba(0,200,83,0.35);'
        }),
        h('div', {},
          h('b', { style: 'font-size:19px' }, p.displayName || 'Runner'),
          h('div', { class: 'muted', style: 'font-size:13px' },
            (() => {
              const city = p.homeCity || 'Dar es Salaam';
              const contact = auth.currentUser?.email || auth.currentUser?.phoneNumber || null;
              return contact ? `${city} · ${contact}` : city;
            })()
          ))),
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
  );

  // Admin-only: Platform Console tile (check claim asynchronously)
  const adminSection = h('div');
  view.append(adminSection);
  auth.currentUser.getIdTokenResult().then((token) => {
    if (token.claims.admin) {
      adminSection.append(
        h('div', {
          class: 'tile',
          style: 'border:1px solid rgba(229,169,60,0.5);background:rgba(229,169,60,0.07);margin-bottom:4px;',
          onclick: () => { location.hash = '#/platform'; }
        },
          h('div', { class: 'av', style: 'background:rgba(229,169,60,0.15);' }, '🛠'),
          h('div', { class: 'grow' },
            h('b', { style: 'color:#E5A93C' }, 'Platform Console'),
            h('small', {}, 'Verify clubs, manage league, admin tools')),
          h('span', { class: 'faint' }, '›'))
      );
    }
  });

  view.append(
    h('h2', {}, 'Clubs you own/admin'), h('div', { id: 'adminclubs' }),
    h('h2', {}, 'Clubs you joined'), h('div', { id: 'joinedclubs' }),

    h('button', { class: 'btn danger', style: 'margin-top:24px', onclick: async () => {
      await auth.signOut(); location.hash = '#/home';
    } }, 'Sign out'),
    h('p', { class: 'faint', style: 'text-align:center;font-size:11px;margin-top:24px' },
      'Kimbia TZ v1.0 · Made for Tanzanian runners 🇹🇿'));

  // stats + runs query with error fallback for missing index
  function renderActivities(docs) {
    let totalM = 0, weekM = 0, weekN = 0;
    const weekAgo = Date.now() - 7 * 864e5;
    for (const a of docs) {
      totalM += a.distanceM || 0;
      const at = a.startedAt?.toMillis?.() ?? (a.startedAt ? new Date(a.startedAt).getTime() : 0);
      if (at > weekAgo) { weekM += a.distanceM || 0; weekN++; }
    }
    const el = view.querySelector('#stats');
    if (el) {
      el.innerHTML = '';
      el.className = 'row';
      [[String(docs.length), 'RUNS'], [Fmt.km(totalM), 'TOTAL'],
       [`${weekN} · ${Fmt.km(weekM)}`, 'THIS WEEK']].forEach(([v, l]) => {
        el.append(h('div', { class: 'bigstat', style: 'flex:1;background:var(--surface);border:1px solid var(--outline);border-radius:16px' },
          h('b', { class: 'stat-num', style: 'font-size:16px' }, v),
          h('small', { class: 'muted' }, l)));
      });
    }
    const rl = view.querySelector('#runs');
    if (rl) {
      rl.innerHTML = '';
      if (!docs.length) {
        rl.append(h('p', { class: 'muted' }, 'No runs yet — hit 🏃 Track!'));
      } else {
        docs.slice(0, 20).forEach((a) => {
          const secs = a.durationS && a.distanceM ? a.durationS / (a.distanceM / 1000) : 0;
          const dateVal = a.startedAt?.toDate?.() || (a.startedAt ? new Date(a.startedAt) : new Date());
          const weatherTag = a.weather ? ` · ${a.weather.temp}°C ${a.weather.icon || '⛅'}` : '';
          rl.append(h('div', { class: 'tile' },
            h('div', { class: 'av' }, (a.verified || a.source === 'gps') ? '✅' : '🏃'),
            h('div', { class: 'grow' },
              h('b', {}, `${Fmt.km(a.distanceM)} · ${Fmt.dur(a.durationS)} · ${Fmt.pace(secs)} /km`),
              h('small', {}, `${Fmt.dt(dateVal)} · ${a.source || 'gps'}${weatherTag}`)),
            a.weather ? h('div', { style: 'font-size:12px;font-weight:700;color:var(--lime);background:rgba(0,200,83,0.12);padding:4px 8px;border-radius:8px;' }, `${a.weather.temp}°C ${a.weather.icon}`) : null
          ));
        });
      }
    }
  }

  const qOrdered = query(collection(db, 'activities'), where('userId', '==', uid), orderBy('startedAt', 'desc'), limit(300));
  const qSimple = query(collection(db, 'activities'), where('userId', '==', uid), limit(300));

  onSnapshot(qOrdered, (snap) => {
    const docs = snap.docs.map((d) => d.data());
    renderActivities(docs);
  }, (err) => {
    console.warn('Ordered activities query failed, using fallback query:', err);
    onSnapshot(qSimple, (snap) => {
      const docs = snap.docs.map((d) => d.data());
      docs.sort((a, b) => {
        const tA = a.startedAt?.toMillis?.() || (a.startedAt ? new Date(a.startedAt).getTime() : 0);
        const tB = b.startedAt?.toMillis?.() || (b.startedAt ? new Date(b.startedAt).getTime() : 0);
        return tB - tA;
      });
      renderActivities(docs);
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
