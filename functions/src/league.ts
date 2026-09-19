import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { scoreClub, DEFAULT_WEIGHTS, Weights } from './scoring';
const db = admin.firestore();

export async function rollup(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;

  const cfg = await db.doc('config/scoring').get();
  const w: Weights = { ...DEFAULT_WEIGHTS, ...(cfg.data() ?? {}) };

  const clubs = await db.collection('clubs').get();
  const results: { id: string; name: string; score: number }[] = [];

  for (const club of clubs.docs) {
    const runs = (await db.collection('activities')
      .where('clubId', '==', club.id)
      .where('verified', '==', true)
      .where('startedAt', '>=', start)
      .where('startedAt', '<', end)
      .select('userId', 'distanceM', 'clubEventId', 'challengeId').get()
    ).docs.map(d => ({
      userId: d.data().userId as string,
      distanceM: (d.data().distanceM ?? 0) as number,
      hasEvent: d.data().clubEventId != null,
      hasChallenge: d.data().challengeId != null,
    }));

    const regs = await db.collectionGroup('registrations')
      .where('clubId', '==', club.id).where('status', '==', 'paid').get();

    const s = scoreClub(
      { runs, paidRegistrations: regs.size, memberCount: club.data().memberCount }, w);
    await db.doc(`leaderboards/monthly/${key}/clubs/${club.id}`)
      .set({ clubId: club.id, clubName: club.data().name, ...s });
    results.push({ id: club.id, name: club.data().name, score: s.score });
  }

  results.sort((a, b) => b.score - a.score);
  const winner = results[0];
  if (winner && winner.score > 0) {
    await db.doc(`awards/${key}`).set({
      clubId: winner.id, clubName: winner.name,
      score: winner.score, month: key, awardedAt: new Date(),
    });
  }
  return results;
}

export const monthlyLeagueRollup = onSchedule(
  { schedule: '30 0 1 * *', timeZone: 'Africa/Dar_es_Salaam', region: 'africa-south1' },
  async () => { await rollup(new Date()); });

/** Platform console "Run rollup now" button */
export const runLeagueRollupNow = onCall(
  { region: 'africa-south1' }, async (req) => {
    if (req.auth?.token?.admin !== true) {
      throw new HttpsError('permission-denied', 'Platform admin only');
    }
    const results = await rollup(new Date());
    return { winner: results[0] ?? null, totalClubs: results.length };
  });
