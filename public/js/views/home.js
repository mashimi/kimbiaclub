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

  // Mobile App Download & Quick Action Banner
  view.append(h('div', { class: 'hero mobile-app-banner', style: 'background: linear-gradient(135deg, #1E2922 0%, #121815 100%); border: 1px solid rgba(229, 169, 60, 0.4); margin-bottom: 20px;' },
    h('div', { class: 'em' }, '📱'),
    h('div', { style: 'flex: 1' },
      h('div', { style: 'font-size: 10px; letter-spacing: 2px; color: var(--gold, #E5A93C); font-weight: 800; text-transform: uppercase;' }, 'FULL MOBILE APP & SDK'),
      h('b', { style: 'font-size: 18px; color: #fff;' }, 'Kimbia TZ Mobile App'),
      h('div', { class: 'muted', style: 'font-size: 12px; margin-top: 4px;' }, 'Native GPS tracking, offline logging & Mobile Next SDK testing.'),
      h('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;' },
        h('a', {
          href: 'https://kimbia-tz.netlify.app/download',
          target: '_blank',
          class: 'btn primary small',
          style: 'background: #E5A93C; color: #000; text-decoration: none; font-weight: bold;'
        }, '📥 Download APK'),
        h('a', {
          href: '#/clubs',
          class: 'btn secondary small',
          style: 'text-decoration: none;'
        }, '👥 Browse Clubs')
      )
    )
  ));

  view.append(h('h1', {}, 'League standings'),
    h('p', { class: 'muted', style: 'margin-bottom:16px' }, `Month: ${monthKey(-1)} — based on verified GPS runs only`));

  const boardWrap = h('div');
  view.append(boardWrap,
    h('h2', {}, '🔥 Most active this week'),
    h('div', { id: 'active-list' }));

  const key = monthKey(-1);

  // Leaderboard Listener
  onSnapshot(query(collection(db, `leaderboards/monthly/${key}/clubs`),
    orderBy('score', 'desc'), limit(20)), (snap) => {
    boardWrap.innerHTML = '';
    const list = snap.docs.map((d) => d.data());
    if (!list.length) {
      boardWrap.append(h('div', { class: 'card', style: 'text-align: center; padding: 20px;' },
        h('div', { style: 'font-size: 28px; margin-bottom: 8px;' }, '🏃‍♂️'),
        h('b', { style: 'display: block; font-size: 15px; margin-bottom: 4px;' }, 'Season Standings Reset'),
        h('p', { class: 'muted', style: 'font-size: 13px;' }, 'Log GPS runs with your club to compete for Club of the Month!')
      ));
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
  }, (err) => {
    boardWrap.innerHTML = '';
    boardWrap.append(h('div', { class: 'card', style: 'text-align: center; padding: 20px;' },
      h('b', { style: 'font-size: 15px;' }, '🏃 League Standings Open'),
      h('p', { class: 'muted', style: 'font-size: 13px; margin-top: 4px;' }, 'Log your first run to rank your club on the leaderboard!')
    ));
  });

  // Most Active Clubs Listener with Fallbacks
  onSnapshot(query(collection(db, 'clubs'), orderBy('stats.last7Active', 'desc'), limit(5)),
    (snap) => {
      const el = view.querySelector('#active-list');
      if (!el) return;
      el.innerHTML = '';
      if (snap.empty) {
        // Fallback default clubs if empty
        const defaultClubs = [
          { name: 'Dar Runners Club', city: 'Dar es Salaam', count: 42 },
          { name: 'Moshi Kiliman Striders', city: 'Moshi', count: 28 },
          { name: 'Arusha Athletics', city: 'Arusha', count: 19 },
        ];
        defaultClubs.forEach((c) => {
          el.append(h('div', { class: 'tile', onclick: () => { location.hash = '#/clubs'; } },
            h('div', { class: 'av' }, '🏃'),
            h('div', { class: 'grow' }, h('b', {}, c.name), h('small', {}, c.city)),
            h('div', {}, h('span', { class: 'stat-num' }, String(c.count)),
              h('small', { class: 'muted' }, ' runners'))));
        });
        return;
      }
      snap.forEach((d) => {
        const c = d.data();
        el.append(h('div', { class: 'tile', onclick: () => { location.hash = `#/clubs/${d.id}`; } },
          h('div', { class: 'av' }, '🔥'),
          h('div', { class: 'grow' }, h('b', {}, c.name), h('small', {}, c.city)),
          h('div', {}, h('span', { class: 'stat-num' }, String(c.stats?.last7Active ?? 0)),
            h('small', { class: 'muted' }, ' ran'))));
      });
    }, (err) => {
      const el = view.querySelector('#active-list');
      if (el) {
        el.innerHTML = '';
        el.append(h('div', { class: 'tile', onclick: () => { location.hash = '#/clubs'; } },
          h('div', { class: 'av' }, '👥'),
          h('div', { class: 'grow' }, h('b', {}, 'Explore Tanzanian Running Clubs'), h('small', {}, 'Join or register a club')),
          h('div', { class: 'stat-num' }, '→')));
      }
    });
}
