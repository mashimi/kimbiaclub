import { db } from '../firebase-init.js';
import { collection, doc, onSnapshot, orderBy, query, limit, getDoc } from 'firebase/firestore';
import { h, monthKey } from '../ui.js';

export function renderHome(view) {
  view.innerHTML = '';

  // Club of the Month banner (latest award doc)
  getDoc(doc(db, 'awards', monthKey(-1))).then((s) => {
    if (!s.exists()) return;
    const a = s.data();
    view.prepend(h('div', { class: 'hero' },
      h('div', { class: 'em' }, '🏆'),
      h('div', {},
        h('div', { style: 'font-size:10px;letter-spacing:2px;color:var(--lime);font-weight:800' },
          'CLUB OF THE MONTH'),
        h('b', { style: 'font-size:20px' }, a.clubName || ''),
        h('div', { class: 'muted', style: 'font-size:13px' }, `${a.month} · ${a.score} pts`))));
  }).catch(() => {});

  view.append(h('h1', {}, 'League standings'),
    h('p', { class: 'muted', style: 'margin-bottom:16px' }, `Month: ${monthKey(-1)} — based on verified GPS runs only`));

  const boardWrap = h('div');
  view.append(boardWrap,
    h('h2', {}, '🔥 Most active this week'),
    h('div', { id: 'active-list' }));

  const key = monthKey(-1);
  onSnapshot(query(collection(db, `leaderboards/monthly/${key}/clubs`),
    orderBy('score', 'desc'), limit(20)), (snap) => {
    boardWrap.innerHTML = '';
    const list = snap.docs.map((d) => d.data());
    if (!list.length) {
      boardWrap.append(h('div', { class: 'card' },
        'No results yet. Log GPS runs with your club — standings publish on the 1st!'));
      return;
    }
    // Podium
    const podium = h('div', { class: 'podium' });
    ['🥇', '🥈', '🥉'].forEach((em, i) => {
      const e = list[i];
      if (!e) return;
      podium.append(h('div', {
        class: `p ${i === 0 ? 'gold' : ''}`,
        onclick: () => { location.hash = `#/clubs/${e.clubId}`; },
      }, h('div', { class: 'em' }, em), h('b', {}, e.clubName),
        h('small', { class: 'muted' }, `${e.score} pts`)));
    });
    boardWrap.append(podium);
    list.slice(3, 10).forEach((e, i) => {
      boardWrap.append(h('div', { class: 'tile', onclick: () => { location.hash = `#/clubs/${e.clubId}`; } },
        h('div', { class: 'ranknum' }, String(i + 4)),
        h('div', { class: 'grow' }, h('b', {}, e.clubName),
          h('small', {}, `${Math.round(e.totalKm)} km · ${e.activeMembers} active runners`)),
        h('div', { class: 'stat-num' }, String(e.score))));
    });
  });

  onSnapshot(query(collection(db, 'clubs'), orderBy('stats.last7Active', 'desc'), limit(5)),
    (snap) => {
      const el = view.querySelector('#active-list');
      el.innerHTML = '';
      snap.forEach((d) => {
        const c = d.data();
        el.append(h('div', { class: 'tile', onclick: () => { location.hash = `#/clubs/${d.id}`; } },
          h('div', { class: 'av' }, '🔥'),
          h('div', { class: 'grow' }, h('b', {}, c.name), h('small', {}, c.city)),
          h('div', {}, h('span', { class: 'stat-num' }, String(c.stats?.last7Active ?? 0)),
            h('small', { class: 'muted' }, ' ran'))));
      });
    });
}
