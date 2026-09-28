import { db, auth } from '../firebase-init.js';
import { collection, doc, onSnapshot, orderBy, query, where, getDoc, getDocs,
  updateDoc, setDoc, serverTimestamp, addDoc, writeBatch } from 'firebase/firestore';
import { h, Fmt, toast, spinner } from '../ui.js';
import { scoreClub } from '../stats.js';

const SEED_6_CLUBS = [
  { name: 'The Runners Club (TRC)', city: 'Dar es Salaam', hq: 'Samora Avenue',
    schedule: [{ days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], time: null, type: 'structured group runs' }],
    tags: ['competitive', 'social', 'events'],
    links: { website: 'https://therunnersclub.co.tz',
      strava: 'https://www.strava.com/clubs/the-runners-club-tz-448020' } },
  { name: 'iRun Club Tanzania', city: 'Dar es Salaam', hq: 'Tips Coco, Coco Beach',
    schedule: [{ days: ['Sat'], time: '06:00', type: 'timed 5K/8K/10K PB challenge' }],
    tags: ['social', 'youth', 'competitive'], links: { instagram: 'https://www.instagram.com/irunclubtz/' } },
  { name: 'Utu Kwanza Tribe', city: 'Dar es Salaam', hq: 'Msasani Peninsula',
    schedule: [{ days: ['Tue', 'Thu', 'Sat'], time: '05:45', type: 'weekly sessions — variable routes' }],
    tags: ['charity', 'beginner-friendly', 'free'], links: { website: 'https://www.utukwanzatribe.co.tz' } },
  { name: 'Team Fit Tanzania', city: 'Dar es Salaam', hq: 'Kinondoni',
    schedule: [{ days: ['Mon', 'Wed', 'Sat'], time: '06:00', type: 'group fitness & track training' }],
    tags: ['wellness', 'beginner-friendly'], links: {} },
  { name: 'Dovya Jogging Sport Club', city: 'Dar es Salaam', hq: 'Yombo Dovya Road',
    schedule: [{ days: ['Sat', 'Sun'], time: '06:30', type: 'group jogging + aerobics' }],
    tags: ['grassroots', 'community'], links: {} },
  { name: 'Arusha Run Club', city: 'Arusha', hq: 'Ngorongoro Building',
    schedule: [{ days: ['Sat'], time: '06:45', type: 'weekly run (city + Mt. Meru trails)' }],
    tags: ['social', 'trail', 'free', 'charity'],
    links: { website: 'https://www.arusharunclub.co.tz' } },
];

export async function renderPlatform(view) {
  view.innerHTML = ''; view.append(spinner());
  const token = await auth.currentUser?.getIdTokenResult(true).catch(() => null);
  
  if (!token?.claims?.admin) {
    view.innerHTML = '';
    view.append(h('div', { class: 'card', style: 'text-align:center;padding:40px' },
      h('h2', {}, '🔒 Platform admin only'),
      h('p', { class: 'muted' }, 'Run admin setup script or sign in with admin account.')));
    return;
  }

  view.innerHTML = '';
  view.append(h('h1', {}, '🛠 Platform Console'));

  // ─── 1. Running Clubs Verification & Management ───
  view.append(
    h('div', { class: 'spread', style: 'margin-top:20px; align-items: center;' },
      h('h2', { style: 'margin:0;' }, '🏢 Manage & Verify Running Clubs (6 Total)'),
      h('button', {
        class: 'btn primary small',
        style: 'background: #E5A93C; color: #000; font-weight: bold;',
        onclick: async () => seedClubs()
      }, '🌱 Seed / Reset 6 Official Clubs')
    )
  );

  const clubsListEl = h('div', { style: 'margin-top:12px;' });
  view.append(clubsListEl);

  onSnapshot(query(collection(db, 'clubs'), orderBy('createdAt', 'desc')), (snap) => {
    clubsListEl.innerHTML = '';
    if (snap.empty) {
      clubsListEl.append(h('div', { class: 'card', style: 'text-align:center; padding:20px;' },
        h('p', { class: 'muted' }, 'No clubs created yet. Click "Seed 6 Official Clubs" above to generate your initial 6 Tanzanian running clubs!'),
        h('button', { class: 'btn primary small', style: 'background:#E5A93C; color:#000; margin-top:10px;', onclick: seedClubs }, '🌱 Seed 6 Clubs Now')
      ));
      return;
    }

    snap.forEach((docSnap) => {
      const c = docSnap.data();
      const isVerified = c.verified === true;
      const isPro = c.tier === 'pro';

      clubsListEl.append(h('div', {
        class: 'card',
        style: `border-left: 4px solid ${isVerified ? '#00C853' : '#555'}; margin-bottom: 12px; padding: 16px 18px;`
      },
        // Club header row
        h('div', { class: 'row', style: 'align-items:center; gap:12px; margin-bottom:12px;' },
          h('div', { style: `width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;background:${isVerified ? 'rgba(0,200,83,0.12)' : 'rgba(255,255,255,0.06)'};flex-shrink:0;` },
            isVerified ? '✅' : '🏢'),
          h('div', { class: 'grow' },
            h('div', { style: 'font-size:16px;font-weight:800;' },
              `${c.name || 'Unnamed Club'} ${isPro ? '⭐' : ''}`),
            h('div', { class: 'muted', style: 'font-size:12px;margin-top:2px;' },
              `${c.city || 'Tanzania'} · ${c.memberCount ?? 0} members · HQ: ${c.meetingInfo?.hq || 'TBA'}`)),
          // Verification status badge
          h('span', {
            style: `padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;flex-shrink:0;${isVerified
              ? 'background:rgba(0,200,83,0.15);color:#00C853;border:1px solid rgba(0,200,83,0.4);'
              : 'background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.45);border:1px solid rgba(255,255,255,0.15);'}`
          }, isVerified ? '✓ VERIFIED' : '⏳ UNVERIFIED')
        ),

        // Action buttons
        h('div', { class: 'row', style: 'gap:8px;' },
          // Big verify/unverify button
          h('button', {
            style: `flex:2;padding:10px 0;border-radius:12px;font-size:14px;font-weight:800;border:none;cursor:pointer;transition:all 0.2s;${isVerified
              ? 'background:rgba(255,80,80,0.12);color:#ff6b6b;border:1px solid rgba(255,80,80,0.3);'
              : 'background:#00C853;color:#000;box-shadow:0 4px 14px rgba(0,200,83,0.35);'}`,
            onclick: async (e) => {
              e.target.disabled = true;
              e.target.textContent = '...';
              await updateDoc(docSnap.ref, { verified: !isVerified });
              toast(isVerified ? `❌ Unverified ${c.name}` : `✅ ${c.name} is now Verified!`);
            }
          }, isVerified ? '✕ Revoke Verification' : '✅ Verify Club'),

          // Pro toggle button
          h('button', {
            style: `flex:1;padding:10px 0;border-radius:12px;font-size:13px;font-weight:700;border:none;cursor:pointer;${isPro
              ? 'background:rgba(229,169,60,0.12);color:#E5A93C;border:1px solid rgba(229,169,60,0.3);'
              : 'background:rgba(229,169,60,0.1);color:#E5A93C;border:1px solid rgba(229,169,60,0.25);'}`,
            onclick: async () => {
              await updateDoc(docSnap.ref, { tier: isPro ? 'free' : 'pro' });
              toast(isPro ? `Set to Free` : `${c.name} is now Pro ⭐`);
            }
          }, isPro ? '⭐ Pro (click to free)' : '⭐ Set Pro'),

          // View club link
          h('button', {
            style: 'flex:0.6;padding:10px 0;border-radius:12px;font-size:13px;font-weight:700;border:1px solid rgba(255,255,255,0.15);background:transparent;color:rgba(255,255,255,0.6);cursor:pointer;',
            onclick: () => { location.hash = `#/clubs/${docSnap.id}`; }
          }, '👁 View')
        )
      ));
    });
  });

  // ─── 2. Pending Pro Subscriptions ───
  view.append(h('h2', { style: 'margin-top:28px;' }, 'Pro Payment Requests'));
  const subs = h('div');
  view.append(subs);
  onSnapshot(query(collection(db, 'subrequests'), where('status', '==', 'pending')),
    (snap) => {
      subs.innerHTML = '';
      if (snap.empty) subs.append(h('p', { class: 'muted' }, 'No pending payment requests.'));
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
              b.update(doc(db, 'clubs', r.clubId), { tier: 'pro', verified: true, paidUntil: until });
              b.update(d.ref, { status: 'paid', decidedAt: serverTimestamp(),
                decidedBy: auth.currentUser.uid });
              await b.commit(); toast(`${r.clubName} is now Pro ⭐ & Verified ✅`);
            } }, '✅ Confirm'),
            h('button', { class: 'btn danger small', onclick: () =>
              updateDoc(d.ref, { status: 'rejected', decidedAt: serverTimestamp() }) }, '✕'))));
      });
    });

  // ─── 3. Tools & Config ───
  view.append(h('h2', { style: 'margin-top:28px;' }, 'Tools & Configuration'));
  const cfgSnap = await getDoc(doc(db, 'config', 'payment')).catch(() => null);
  const cfg = cfgSnap && cfgSnap.exists() ? cfgSnap.data() : {};
  const payNum = h('input', { value: cfg.payToNumber || '', placeholder: '0712 345 678' });
  const payName = h('input', { value: cfg.payToName || 'Kimbia TZ' });
  view.append(h('div', { class: 'card' },
    h('b', {}, 'Platform payment number (for Pro upgrades)'),
    h('label', { class: 'field', style: 'margin-top:10px' }, h('span', {}, 'Number'), payNum),
    h('label', { class: 'field' }, h('span', {}, 'Account name'), payName),
    h('button', { class: 'btn small', onclick: async () => {
      await setDoc(doc(doc(db, 'config', 'payment')),
        { payToNumber: payNum.value.trim(), payToName: payName.value.trim() }, { merge: true });
      toast('Saved 💳');
    } }, 'Save')));

  // Standings Publishing
  const rollupBtn = h('button', { class: 'btn secondary', style: 'margin-bottom:10px' }, '⚡ Publish league standings (last month)');
  rollupBtn.onclick = async () => {
    rollupBtn.disabled = true;
    try {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
      const cfgScoring = (await getDoc(doc(db, 'config', 'scoring'))).data() || {};
      const w = { wAvgKm: 35, wAttendance: 30, wTotalKm: 20, wEngagement: 15,
        avgKmCap: 60, attendanceTarget: 0.4, ...cfgScoring };
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

  view.append(rollupBtn, weeklyBtn);

  async function seedClubs() {
    toast('Seeding 6 official clubs...');
    for (const s of SEED_6_CLUBS) {
      await addDoc(collection(db, 'clubs'), { ...s,
        meetingInfo: { hq: s.hq, schedule: s.schedule, payTo: null },
        focusTags: s.tags, tier: 'free', verified: true, claimed: true,
        ownerId: auth.currentUser?.uid || null, memberCount: 15,
        stats: { totalKm: 180, runCount: 30, last7Active: 10 },
        createdAt: serverTimestamp() });
    }
    await setDoc(doc(db, 'config', 'scoring'), {
      wAvgKm: 35, wAttendance: 30, wTotalKm: 20, wEngagement: 15,
      avgKmCap: 60, attendanceTarget: 0.4 }, { merge: true });
    toast('Seeded & Verified all 6 clubs ✅');
  }
}
