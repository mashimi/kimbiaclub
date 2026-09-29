import { db } from '../firebase-init.js';
import { collection, doc, onSnapshot, orderBy, query, limit, getDoc } from 'firebase/firestore';
import { h, monthKey } from '../ui.js';
import { fetchWeather } from '../weather.js';

export function renderHome(view) {
  view.innerHTML = '';

  // Weather Widget
  const weatherEl = h('div', {
    class: 'card',
    style: 'background: linear-gradient(135deg, rgba(19,26,22,0.9) 0%, rgba(28,38,32,0.9) 100%); border: 1px solid var(--outline); padding: 14px 18px; margin-bottom: 20px; border-radius: 18px;'
  },
    h('div', { class: 'spread' },
      h('div', { class: 'row' },
        h('span', { style: 'font-size: 26px;' }, '🌤️'),
        h('div', {},
          h('b', { style: 'font-size: 14px;' }, 'Checking Tanzanian Weather...'),
          h('div', { class: 'muted', style: 'font-size: 12px;' }, 'Fetching conditions for runners')
        )
      )
    )
  );

  fetchWeather(-6.7924, 39.2083, 'Dar es Salaam').then((w) => {
    weatherEl.innerHTML = '';
    weatherEl.append(
      h('div', { class: 'spread', style: 'flex-wrap: wrap; gap: 10px;' },
        h('div', { class: 'row', style: 'gap: 12px;' },
          h('span', { style: 'font-size: 32px;' }, w.icon),
          h('div', {},
            h('div', { style: 'display: flex; align-items: center; gap: 8px;' },
              h('b', { style: 'font-size: 18px; color: #fff;' }, `${w.temp}°C`),
              h('span', { style: 'font-size: 13px; font-weight: 700; color: var(--green);' }, w.condition)
            ),
            h('div', { class: 'muted', style: 'font-size: 12px; margin-top: 2px;' },
              `📍 ${w.cityName} · 💨 Wind ${w.windSpeed} km/h · 💧 ${w.humidity}% humidity`
            )
          )
        ),
        h('div', { style: 'background: rgba(0,200,83,0.12); padding: 6px 12px; border-radius: 10px; border: 1px solid rgba(0,200,83,0.3);' },
          h('span', { style: 'font-size: 10px; font-weight: 800; color: var(--lime); display: block; letter-spacing: 1px;' }, 'RUNNER TIP'),
          h('span', { style: 'font-size: 12px; font-weight: 600; color: #fff;' }, w.tip)
        )
      )
    );
  });

  view.append(weatherEl);

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

  // African Runners League Banner
  view.append(h('div', {
    class: 'hero mobile-app-banner',
    style: `position: relative; overflow: hidden; border-radius: 22px; padding: 24px 20px;
            background: linear-gradient(180deg, rgba(10,14,12,0.4) 0%, rgba(10,14,12,0.92) 100%), url('/assets/hero.png') center/cover no-repeat;
            border: 1px solid rgba(0, 200, 83, 0.4); margin-bottom: 24px; min-height: 180px; display: flex; flex-direction: column; justify-content: flex-end;
            box-shadow: 0 12px 32px rgba(0,0,0,0.5);`
  },
    h('div', { style: 'position: relative; z-index: 2;' },
      h('div', { style: 'display: inline-flex; align-items: center; gap: 6px; background: rgba(0, 200, 83, 0.2); border: 1px solid var(--green); padding: 4px 10px; border-radius: 999px; font-size: 11px; color: var(--lime); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;' },
        h('img', { src: '/assets/logo.png', style: 'width: 16px; height: 16px; border-radius: 4px;' }),
        'TANZANIAN RUNNING LEAGUE'
      ),
      h('b', { style: 'font-size: 24px; color: #fff; display: block; line-height: 1.2; font-weight: 900;' }, 'Unite. Run. Conquer.'),
      h('div', { style: 'color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 6px; max-width: 480px; line-height: 1.4;' },
        'The official digital hub for Tanzanian running clubs. Track GPS runs, compete in monthly club rankings, and conquer local races.'
      ),
      h('div', { style: 'display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px;' },
        h('a', {
          href: 'https://kimbia-tz.netlify.app/download',
          target: '_blank',
          class: 'btn primary small',
          style: 'background: var(--green); color: #000; text-decoration: none; font-weight: 800; border-radius: 12px; padding: 10px 16px;'
        }, '📲 Get Mobile App (Android & iOS)'),
        h('a', {
          href: '#/clubs',
          class: 'btn secondary small',
          style: 'text-decoration: none; border-radius: 12px; padding: 10px 16px; background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); color: #fff; border: 1px solid rgba(255,255,255,0.3);'
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
