/* Seeds demo clubs + scoring config into Firestore (no Blaze needed).
   Usage:
     set GOOGLE_APPLICATION_CREDENTIALS=<path-to-key.json>
     node seed.js
*/
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const SEED = [
  { name: 'The Runners Club (TRC)', city: 'Dar es Salaam', hq: 'Samora Avenue',
    schedule: [{ days: ['Mon','Tue','Wed','Thu','Fri','Sat'], time: null, type: 'structured group runs' }],
    tags: ['competitive','social','events'],
    links: { website: 'https://therunnersclub.co.tz',
      strava: 'https://www.strava.com/clubs/the-runners-club-tz-448020' } },
  { name: 'iRun Club Tanzania', city: 'Dar es Salaam', hq: 'Tips Coco, Coco Beach',
    schedule: [{ days: ['Sat'], time: '06:00', type: 'timed 5K/8K/10K PB challenge' }],
    tags: ['social','youth','competitive'], links: { instagram: 'https://www.instagram.com/irunclubtz/' } },
  { name: 'Utu Kwanza Tribe', city: 'Dar es Salaam', hq: null,
    schedule: [{ days: null, time: null, type: 'weekly sessions — variable routes' }],
    tags: ['charity','beginner-friendly','free'], links: { website: 'https://www.utukwanzatribe.co.tz' } },
  { name: 'Team Fit Tanzania', city: 'Dar es Salaam', hq: 'Kinondoni',
    schedule: [{ days: ['Mon','Wed','Sat'], time: null, type: 'group training' }],
    tags: ['wellness','beginner-friendly'], links: {} },
  { name: 'Dovya Jogging Sport Club', city: 'Dar es Salaam', hq: 'Yombo Dovya Road',
    schedule: [{ days: ['Sat','Sun'], time: null, type: 'group jogging + aerobics' }],
    tags: ['grassroots','community'], links: {} },
  { name: 'Arusha Run Club', city: 'Arusha', hq: 'Ngorongoro Building',
    schedule: [{ days: ['Sat'], time: '06:45', type: 'weekly run (city + Mt. Meru trails)' }],
    tags: ['social','trail','free','charity'],
    links: { website: 'https://www.arusharunclub.co.tz' } },
];

(async () => {
  const existing = await db.collection('clubs').where('claimed', '==', false).get();
  if (existing.size > 0) {
    console.log(`ALREADY_SEEDED count=${existing.size}`);
    process.exit(0);
  }
  for (const s of SEED) {
    await db.collection('clubs').add({
      name: s.name, city: s.city,
      meetingInfo: { hq: s.hq, schedule: s.schedule, payTo: null },
      focusTags: s.tags, links: s.links,
      tier: 'free', verified: false, claimed: false,
      ownerId: null, memberCount: 0,
      stats: { totalKm: 0, runCount: 0, last7Active: 0 },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await db.doc('config/scoring').set({
    wAvgKm: 35, wAttendance: 30, wTotalKm: 20, wEngagement: 15,
    avgKmCap: 60, attendanceTarget: 0.4,
  }, { merge: true });
  console.log(`SEEDED clubs=${SEED.length}`);
  process.exit(0);
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
