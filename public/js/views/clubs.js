import { db, auth } from '../firebase-init.js';
import { collection, doc, onSnapshot, orderBy, query, limit, where,
  setDoc, serverTimestamp } from 'firebase/firestore';
import { h, toast } from '../ui.js';
import { state } from '../app.js';

export function renderClubs(view) {
  view.innerHTML = '';
  view.append(h('div', { class: 'spread' },
    h('h1', {}, 'Running Clubs'), h('a', { href: '#/create-club' },
      h('button', { class: 'btn small' }, '+ New club'))));
  const search = h('input', { placeholder: 'Search club or city…' });
  const list = h('div', { style: 'margin-top:14px' });
  view.append(search, list);

  let clubs = [];
  search.oninput = () => paint();
  onSnapshot(collection(db, 'clubs'), (snap) => {
    clubs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    paint();
  });
  function paint() {
    const q = search.value.trim().toLowerCase();
    list.innerHTML = '';
    clubs
      .filter((c) => !q || (c.name || '').toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q))
      .sort((a, b) => (b.stats?.last7Active ?? 0) - (a.stats?.last7Active ?? 0))
      .forEach((c) => {
        const sched = c.meetingInfo?.schedule?.[0] || {};
        const days = Array.isArray(sched.days) ? sched.days.join(' ') : '';
        list.append(h('div', { class: 'tile', onclick: () => { location.hash = `#/clubs/${c.id}`; } },
          h('div', { class: 'av' }, c.logoUrl ? h('img', { src: c.logoUrl, style: 'width:100%;border-radius:50%' }) : '🏃'),
          h('div', { class: 'grow' },
            h('b', {}, `${c.name || ''} ${c.tier === 'pro' ? '⭐' : ''} ${c.verified ? '✓' : ''}`),
            h('small', {}, [days, sched.time, c.city].filter(Boolean).join(' · '))),
          h('div', { style: 'text-align:right' },
            h('div', { class: 'stat-num' }, String(c.stats?.last7Active ?? 0)),
            h('small', { class: 'faint' }, 'ran this wk'))));
      });
  }
}

export function renderClubDetail(view, clubId) {
  view.innerHTML = '';
  const ref = doc(db, 'clubs', clubId);
  let club = null, myRole = null;

  const render = () => {
    view.innerHTML = '';
    if (!club) return;
    const sched = club.meetingInfo?.schedule || [];
    const payTo = club.meetingInfo?.payTo;
    const isAdmin = ['owner', 'admin'].includes(myRole);
    const isMember = !!myRole && myRole !== 'none';

    view.append(
      h('div', { class: 'spread' },
        h('h1', {}, `${club.name || ''} ${club.tier === 'pro' ? '⭐' : ''}`),
        isAdmin ? h('a', { href: `#/admin/${clubId}` },
          h('button', { class: 'btn small' }, '⚙️ Admin')) : null),
      h('p', { class: 'muted' }, `${club.city || ''} · 📍 ${club.meetingInfo?.hq || 'TBA'}`),
      h('div', { class: 'row', style: 'margin:16px 0' },
        h('div', { class: 'bigstat', style: 'flex:1;background:var(--surface);border:1px solid var(--outline);border-radius:16px' },
          h('b', { class: 'stat-num', id: 'week-active' }, String(club.stats?.last7Active ?? 0)), h('small', { class: 'muted' }, 'ran this week')),
        h('div', { class: 'bigstat', style: 'flex:1;background:var(--surface);border:1px solid var(--outline);border-radius:16px' },
          h('b', {}, String(club.memberCount ?? 0)), h('small', { class: 'muted' }, 'members'))),

      h('h2', {}, 'Schedule'),
      ...sched.map((s) => h('div', { class: 'card' },
        h('b', {}, [Array.isArray(s.days) ? s.days.join(', ') : s.days, s.time].filter(Boolean).join(' — ')),
        h('div', { class: 'muted', style: 'font-size:14px' }, s.type || ''))),

      payTo ? h('div', { class: 'paybox' },
        h('small', { class: 'muted' }, 'Membership / event payments to:'),
        h('div', { class: 'num' }, `${payTo.number} (${payTo.network || ''})`),
        payTo.name ? h('small', {}, `Name: ${payTo.name}`) : null) : null,

      h('div', { style: 'margin:18px 0' }, joinButton()),

      Object.entries(club.links || {}).filter(([, u]) => u).map(([k, u]) =>
        h('a', { href: u, target: '_blank', rel: 'noopener' },
          h('button', { class: 'btn secondary', style: 'margin-bottom:8px' }, `↗ ${k}`))),

      h('h2', {}, 'Recent club runs'),
      h('div', { id: 'runs' }),
    );

    onSnapshot(query(collection(db, 'activities'),
      where('clubId', '==', clubId), orderBy('startedAt', 'desc'), limit(300)),
      (snap) => {
        // live weekly-active count (replaces the scheduled Cloud Function)
        const weekAgo = Date.now() - 7 * 864e5;
        const users = new Set(snap.docs
          .filter((d) => (d.data().startedAt?.toMillis?.() ?? 0) > weekAgo)
          .map((d) => d.data().userId));
        const wa = view.querySelector('#week-active');
        if (wa) wa.textContent = String(users.size);
        const el = view.querySelector('#runs');
        if (!el) return;
        el.innerHTML = '';
        if (snap.empty) { el.append(h('p', { class: 'muted' }, 'No runs logged yet.')); return; }
        snap.docs.slice(0, 10).forEach((d) => {
          const a = d.data();
          el.append(h('div', { class: 'tile' },
            h('div', { class: 'av' }, (a.verified || a.source === 'gps') ? '✅' : '🏃'),
            h('div', { class: 'grow' },
              h('b', {}, `${(a.distanceM / 1000).toFixed(2)} km · ${Math.round(a.durationS / 60)} min`),
              h('small', {}, new Date(a.startedAt?.toMillis?.() ?? Date.now()).toLocaleString()))));
        });
      });
  };

  function joinButton() {
    if (!state.user) return h('a', { href: '#/home' }, h('button', { class: 'btn' }, 'Sign in to join'));
    if (myRole === 'pending') return h('button', { class: 'btn', disabled: true }, 'Request pending…');
    if (myRole) return h('button', { class: 'btn secondary', disabled: true }, `Member · ${myRole}`);
    return h('button', { class: 'btn', onclick: async () => {
      await setDoc(doc(db, 'clubs', clubId, 'members', auth.currentUser.uid), {
        role: 'member', status: 'pending', userId: auth.currentUser.uid,
        displayName: state.profile?.displayName || 'Runner', joinedAt: serverTimestamp(),
      });
      toast('Join request sent! 🙋');
    } }, 'Join this club');
  }

  onSnapshot(ref, (s) => { club = s.data(); render(); });
  onSnapshot(doc(db, 'clubs', clubId, 'members', auth.currentUser?.uid || '_'), (s) => {
    myRole = s.exists() && s.data().status === 'active' ? s.data().role
      : s.exists() ? 'pending' : null;
    if (club) render();
  });
}
