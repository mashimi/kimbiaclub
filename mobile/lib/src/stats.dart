/// League scoring math (ported from web stats.js / functions scoring.ts).
library;

import 'dart:math';

class ClubScore {
  final int score;
  final num totalKm;
  final int activeMembers;
  final int runCount;
  final num avgKm;
  ClubScore(this.score, this.totalKm, this.activeMembers, this.runCount, this.avgKm);
}

class RunLite {
  final String userId;
  final num distanceM;
  RunLite(this.userId, this.distanceM);
}

ClubScore scoreClub(List<RunLite> runs, int memberCount, Map<String, dynamic> w) {
  final totalKm = runs.fold(0.0, (s, r) => s + r.distanceM) / 1000;
  final perUser = <String, List<num>>{};
  for (final r in runs) {
    final u = perUser.putIfAbsent(r.userId, () => [0, 0]);
    u[0] = u[0] + r.distanceM / 1000;
    u[1] = u[1] + 1;
  }
  final activeMembers = perUser.length;
  final avgKm = activeMembers > 0 ? totalKm / activeMembers : 0;
  final avgCap = (w['avgKmCap'] ?? 60) as num;
  final avgScore = min(1.0, avgKm / max(1.0, avgCap));
  final members = memberCount > 0 ? memberCount : activeMembers;
  final attTarget = ((w['attendanceTarget'] ?? 0.4) as num);
  final attendance =
      members > 0 ? min(1.0, activeMembers / max(0.01, members * attTarget)) : 0.0;
  final totalKmScore = min(1.0, totalKm / 500);
  double eng = 0;
  for (final u in perUser.values) {
    eng += min(1.0, u[1] / 8);
  }
  final engagement = activeMembers > 0 ? eng / activeMembers : 0.0;
  final wAvg = (w['wAvgKm'] ?? 35) as num;
  final wAtt = (w['wAttendance'] ?? 30) as num;
  final wTot = (w['wTotalKm'] ?? 20) as num;
  final wEng = (w['wEngagement'] ?? 15) as num;
  final score = (wAvg * avgScore + wAtt * attendance + wTot * totalKmScore + wEng * engagement).round();
  return ClubScore(
    score,
    (totalKm * 10).round() / 10,
    activeMembers,
    runs.length,
    (avgKm * 10).round() / 10,
  );
}