import { doc, runTransaction, increment } from 'firebase/firestore';
import { db } from './firebase-init.js';

/**
 * No-Blaze mode: instead of a Cloud Function trigger, the client bumps club
 * stats right after saving a club-tagged activity. Security rules restrict
 * stats-only updates to club members.
 */
export async function bumpClubStats(clubId, distanceM) {
  if (!clubId) return;
  try {
    await runTransaction(db, (tx) => tx.update(doc(db, 'clubs', clubId), {
      'stats.totalKm': increment(distanceM / 1000),
      'stats.runCount': increment(1),
      'stats.lastActivityAt': new Date(),
    }));
  } catch { /* non-fatal: stats drift can be repaired by the platform refresh */ }
}

/** Same scoring math as functions/src/scoring.ts, client-side. */
export function scoreClub(runs, memberCount, w) {
  const totalKm = runs.reduce((s, r) => s + (r.distanceM ?? 0), 0) / 1000;
  const perUser = new Map();
  for (const r of runs) {
    const u = perUser.get(r.userId) ?? { km: 0, runs: 0 };
    u.km += (r.distanceM ?? 0) / 1000;
    u.runs += 1;
    perUser.set(r.userId, u);
  }
  const activeMembers = perUser.size;
  const avgKm = activeMembers > 0 ? totalKm / activeMembers : 0;
  const avgScore = Math.min(1, avgKm / Math.max(1, w.avgKmCap));
  const members = memberCount > 0 ? memberCount : activeMembers;
  const attendance = members > 0
    ? Math.min(1, activeMembers / Math.max(0.01, members * w.attendanceTarget)) : 0;
  const totalKmScore = Math.min(1, totalKm / 500);
  // engagement proxy: consistency — share of members running weekly-ish
  const engagement = activeMembers > 0
    ? [...perUser.values()].reduce((s, u) => s + Math.min(1, u.runs / 8), 0) / activeMembers : 0;
  const score = Math.round(
    w.wAvgKm * avgScore + w.wAttendance * attendance +
    w.wTotalKm * totalKmScore + w.wEngagement * engagement);
  return {
    score, totalKm: Math.round(totalKm * 10) / 10,
    activeMembers, runCount: runs.length, avgKm: Math.round(avgKm * 10) / 10,
  };
}
