export interface Weights {
  wAvgKm: number;
  wAttendance: number;
  wTotalKm: number;
  wEngagement: number;
  avgKmCap: number;
  attendanceTarget: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  wAvgKm: 35,
  wAttendance: 30,
  wTotalKm: 20,
  wEngagement: 15,
  avgKmCap: 60,
  attendanceTarget: 0.4,
};

export interface LeagueRun {
  userId: string;
  distanceM: number;
  hasEvent: boolean;
  hasChallenge: boolean;
}

export interface ClubInput {
  runs: LeagueRun[];
  paidRegistrations: number;
  memberCount?: number;
}

export interface ClubScore {
  score: number;
  totalKm: number;
  activeMembers: number;
  runCount: number;
  avgKm: number;
  paidRegistrations: number;
}

const TOTAL_KM_TARGET = 500;

/**
 * Monthly league score for a club (0–100).
 * - avgKm:       average km per active member, capped at avgKmCap (rewards quality)
 * - attendance:  share of members who ran at least once vs attendanceTarget
 * - totalKm:     club total km vs TOTAL_KM_TARGET (rewards volume)
 * - engagement:  share of runs tied to a club event or challenge
 */
export function scoreClub(input: ClubInput, w: Weights): ClubScore {
  const runs = input.runs ?? [];
  const totalKm = runs.reduce((s, r) => s + (r.distanceM ?? 0), 0) / 1000;

  const perUser = new Map<string, { km: number; extras: number }>();
  for (const r of runs) {
    const u = perUser.get(r.userId) ?? { km: 0, extras: 0 };
    u.km += (r.distanceM ?? 0) / 1000;
    if (r.hasEvent) u.extras += 1;
    if (r.hasChallenge) u.extras += 1;
    perUser.set(r.userId, u);
  }
  const activeMembers = perUser.size;
  const avgKm = activeMembers > 0 ? totalKm / activeMembers : 0;

  const avgScore = Math.min(1, avgKm / Math.max(1, w.avgKmCap));

  const members = input.memberCount && input.memberCount > 0
    ? input.memberCount
    : activeMembers;
  const attendance = members > 0
    ? Math.min(1, activeMembers / Math.max(0.01, members * w.attendanceTarget))
    : 0;

  const totalKmScore = Math.min(1, totalKm / TOTAL_KM_TARGET);

  const engagement = activeMembers > 0
    ? [...perUser.values()].reduce((s, u) => s + Math.min(1, u.extras / 4), 0) / activeMembers
    : 0;

  const score = Math.round(
    w.wAvgKm * avgScore +
    w.wAttendance * attendance +
    w.wTotalKm * totalKmScore +
    w.wEngagement * engagement,
  );

  return {
    score,
    totalKm: Math.round(totalKm * 10) / 10,
    activeMembers,
    runCount: runs.length,
    avgKm: Math.round(avgKm * 10) / 10,
    paidRegistrations: input.paidRegistrations ?? 0,
  };
}
