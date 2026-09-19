import { db, auth } from '../firebase-init.js';
import { collection, doc, onSnapshot, orderBy, query, where, getDoc, getDocs,
  updateDoc, setDoc, serverTimestamp, addDoc, writeBatch } from 'firebase/firestore';
import { h, Fmt, toast, spinner } from '../ui.js';
import { scoreClub } from '../stats.js';

const SEED = [
  { name: 'The Runners Club (TRC)', city: 'Dar es Salaam', hq: 'Samora Avenue',
    schedule: [{ days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], time: null, type: 'structured group runs' }],
    tags: ['competitive', 'social', 'events'],
    links: { website: 'https://therunnersclub.co.tz',
      strava: 'https://www.strava.com/clubs/the-runners-club-tz-448020' } },
  { name: 'iRun Club Tanzania', city: 'Dar es Salaam', hq: 'Tips Coco, Coco Beach',
    schedule: [{ days: ['Sat'], time: '06:00', type: 'timed 5K/8K/10K PB challenge' }],
    tags: ['social', 'youth', 'competitive'], links: { instagram: 'https://www.instagram.com/irunclubtz/' } },
  { name: 'Utu Kwanza Tribe', city: 'Dar es Salaam', hq: null,
    schedule: [{ days: null, time: null, type: 'weekly sessions — variable routes' }],
    tags: ['charity', 'beginner-friendly', 'free'], links: { website: 'https://www.utukwanzatribe.co.tz' } },
  { name: 'Team Fit Tanzania', city: 'Dar es Salaam', hq: 'Kinondoni',
    schedule: [{ days: ['Mon', 'Wed', 'Sat'], time: null, type: 'group training' }],
    tags: ['wellness', 'beginner-friendly'], links: {} },
  { name: 'Dovya Jogging Sport Club', city: 'Dar es Salaam', hq: 'Yombo Dovya Road',
    schedule: [{ days: ['Sat', 'Sun'], time: null, type: 'group jogging + aerobics' }],
    tags: ['grassroots', 'community'], links: {} },
  { name: 'Arusha Run Club', city: 'Arusha', hq: 'Ngorongoro Building',
    schedule: [{ days: ['Sat'], time: '06:45', type: 'weekly run (city + Mt. Meru trails)' }],
    tags: ['social', 'trail', 'free', 'charity'],
    links: { website: 'https://www.arusharunclub.co.tz' } },
];

export async function renderPlatform(view) {
  view.innerHTML = ''; view.append(spinner());
  const token = await auth.currentUser.getIdTokenResult(true);
  if (!token.claims.admin) {
    view.innerHTML = '';
    view.append(h('div', { class: 'card', style: 'text-align:center;padding:40px' },
      h('h2', {}, '🔒 Platform admin only')));
    return;
  }
  view.innerHTML = '';
  view.append(h('h1', {}, '🛠 Platform console'));

  // Pending Pro subscriptions
  view.append(h('h2', {}, 'Pro payment requests'));
  const subs = h('div');
  view.append(subs);
  onSnapshot(query(collection(db, 'subrequests'), where('status', '==', 'pending')),
    (snap) => {
      subs.innerHTML = '';
      if (snap.empty) subs.append(h('p', { class: 'muted' }, 'No pending requests.'));
      snap.forEach((d) => {
        const r = d.data();
        subs.append(h('div', { class: 'tile' },
          h('div', { class: 'av' }, '⭐'),
          h('div', { class: 'grow' }, h('b', {}, r.clubName),
            h('small', {}, `${r.payerPhone || '?'} · ${r.txRef || 'no ref'} · ${Fmt.tzs(r.amount)}`)),
          h('div', { class: 'row' },
            h('button', { class: 'btn small', onclick: async () => {
              const until = new Date(); until.setFullYear(until.getFullYear() + 1);
              const b = writeBatch(db);
              b.update(doc(db, 'clubs', r.clubId), { tier: 'pro', paidUntil: until });
              b.update(d.ref, { status: 'paid', decidedAt: serverTimestamp(),
                decidedBy: auth.currentUser.uid });
              await b.commit(); toast(`${r.clubName} is now Pro ⭐`);
            } }, '✅ Confirm'),
            h('button', { class: 'btn danger small', onclick: () =>
              updateDoc(d.ref, { status: 'rejected', decidedAt: serverTimestamp() }) }, '✕'))));
      });
    });

  // Tools
  view.append(h('h2', {}, 'Tools'));
  const cfgSnap = await getDoc(doc(db, 'config', 'payment'));
  const cfg = cfgSnap.data() || {};
  const payNum = h('input', { value: cfg.payToNumber || '', placeholder: '0712 345 678' });
  const payName = h('input', { value: cfg.payToName || 'Kimbia TZ' });
  view.append(h('div', { class: 'card' },
    h('b', {}, 'Platform payment number (for Pro upgrades)'),
    h('label', { class: 'field', style: 'margin-top:10px' }, h('span', {}, 'Number'), payNum),
    h('label', { class: 'field' }, h('span', {}, 'Account name'), payName),
    h('button', { class: 'btn small', onclick: async () => {
      await setDoc(doc(db, 'config', 'payment'),
        { payToNumber: payNum.value.trim(), payToName: payName.value.trim() }, { merge: true });
      toast('Saved 💳');
    } }, 'Save')));

  // No-Blaze mode: league rollup + weekly-active refresh run client-side
  // as platform admin (Cloud Functions were Blaze-only).
  const rollupBtn = h('button', { class: 'btn secondary', style: 'margin-bottom:10px' }, '⚡ Publish league standings (last month)');
  rollupBtn.onclick = async () => {
    rollupBtn.disabled = true;
    try {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
      const cfg = (await getDoc(doc(db, 'config', 'scoring'))).data() || {};
      const w = { wAvgKm: 35, wAttendance: 30, wTotalKm: 20, wEngagement: 15,
        avgKmCap: 60, attendanceTarget: 0.4, ...cfg };
      const clubs = await getDocs(collection(db, 'clubs'));
      const results = [];
      for (const c of clubs.docs) {
        const runs = (await getDocs(query(collection(db, 'activities'),
          where('clubId', '==', c.id), where('source', '==', 'gps'),
          where('startedAt', '>=', start), where('startedAt', '<', end)))).docs
          .map((d) => ({ userId: d.data().userId, distanceM: d.data().distanceM ?? 0 }));
        const s = scoreClub(runs, c.data().memberCount ?? 0, w);
        await setDoc(doc(db, `leaderboards/monthly/${key}/clubs/${c.id}`),
          { clubId: c.id, clubName: c.data().name, ...s });
        results.push({ id: c.id, name: c.data().name, score: s.score });
      }
      results.sort((a, b) => b.score - a.score);
      const winner = results[0];
      if (winner && winner.score > 0) {
        await setDoc(doc(db, 'awards', key), {
          clubId: winner.id, clubName: winner.name,
          score: winner.score, month: key, awardedAt: new Date(),
        });
      }
      toast(winner && winner.score > 0 ? `Published! Winner: ${winner.name} 🏆` : 'Published (no scores yet)');
    } catch (e) { toast(e.message); }
    rollupBtn.disabled = false;
  };

  const weeklyBtn = h('button', { class: 'btn secondary', style: 'margin-bottom:10px' }, '🔄 Refresh weekly-active counts');
  weeklyBtn.onclick = async () => {
    weeklyBtn.disabled = true;
    try {
      const weekAgo = new Date(Date.now() - 7 * 864e5);
      const clubs = await getDocs(collection(db, 'clubs'));
      let n = 0;
      for (const c of clubs.docs) {
        const snap = await getDocs(query(collection(db, 'activities'),
          where('clubId', '==', c.id), where('startedAt', '>=', weekAgo)));
        const users = new Set(snap.docs.map((d) => d.data().userId));
        await updateDoc(c.ref, { 'stats.last7Active': users.size });
        n++;
      }
      toast(`Refreshed ${n} clubs ✅`);
    } catch (e) { toast(e.message); }
    weeklyBtn.disabled = false;
  };

  view.append(rollupBtn, weeklyBtn,
    h('button', { class: 'btn secondary', onclick: async () => {
      for (const s of SEED) {
        await addDoc(collection(db, 'clubs'), { ...s,
          meetingInfo: { hq: s.hq, schedule: s.schedule, payTo: null },
          focusTags: s.tags, tier: 'free', verified: false, claimed: false,
          ownerId: null, memberCount: 0,
          stats: { totalKm: 0, runCount: 0, last7Active: 0 },
          createdAt: serverTimestamp() });
      }
      await setDoc(doc(db, 'config', 'scoring'), {
        wAvgKm: 35, wAttendance: 30, wTotalKm: 20, wEngagement: 15,
        avgKmCap: 60, attendanceTarget: 0.4 }, { merge: true });
      toast('Seeded 6 clubs ✅');
    } }, '🌱 Seed demo clubs'));
}
