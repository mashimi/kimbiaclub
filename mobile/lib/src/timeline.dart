/// Google Timeline parsing + Recap Studio export (ported from web timeline.js).
library;

import 'dart:convert';

class TimelineRun {
  final DateTime start;
  final DateTime end;
  final num distM;
  TimelineRun(this.start, this.end, this.distM);
}

/// Extracts runs from a Google Timeline export (both formats), 100% on-device.
List<TimelineRun> extractRuns(String jsonText) {
  dynamic data;
  try {
    data = jsonDecode(jsonText);
  } catch (_) {
    return [];
  }
  final segs = data is List ? data : (data['semanticSegments'] ?? []);
  final runs = <TimelineRun>[];
  if (segs is List) {
    for (final s in segs) {
      if (s is! Map) continue;
      try {
        final act = s['activity'];
        if (act == null || act is! Map) continue;
        final top = act['topCandidate'];
        if (top == null || top is! Map) continue;
        final type = top['type'];
        final start = DateTime.parse(s['startTime'].toString());
        final end = DateTime.parse(s['endTime'].toString());
        final rawDist = act['distanceMeters'];
        final dist = (rawDist is num) ? rawDist : 0;
        final secs = end.difference(start).inSeconds;
        final speed = secs > 0 ? dist / secs : 0;
        final isRun = type == 'RUNNING' || (type == 'WALKING' && speed >= 2.0 && speed <= 4.5);
        if (isRun && dist >= 1500) runs.add(TimelineRun(start, end, dist));
      } catch (_) {
        // skip malformed segment
      }
    }
  }
  runs.sort((a, b) => a.start.isBefore(b.start) ? -1 : 1);
  return runs;
}

class RunPoint {
  final double lat;
  final double lng;
  final int t;
  RunPoint(this.lat, this.lng, this.t);
}

class GpsRun {
  final List<RunPoint> points;
  final num distanceM;
  GpsRun(this.points, this.distanceM);
}

/// Builds a Timeline.json (semanticSegments) from the app's GPS runs → Recap Studio.
String runsToTimelineJson(List<GpsRun> runs) {
  final segs = <Map<String, dynamic>>[];
  for (final r in runs) {
    final pts = r.points;
    if (pts.length < 2) continue;
    final t0 = pts.first.t;
    final paths = pts.map((p) => <String, dynamic>{
      'point': '${p.lat.toStringAsFixed(6)}°, ${p.lng.toStringAsFixed(6)}°',
      'durationMinutesOffset': ((p.t - t0) / 60000).toString(),
    }).toList();
    segs.add(<String, dynamic>{
      'startTime': DateTime.fromMillisecondsSinceEpoch(t0).toIso8601String(),
      'endTime':
          DateTime.fromMillisecondsSinceEpoch(pts.last.t).toIso8601String(),
      'activity': {
        'topCandidate': {'type': 'RUNNING', 'probability': 1},
        'distanceMeters': r.distanceM,
      },
      'timelinePath': paths,
    });
  }
  return jsonEncode({'semanticSegments': segs});
}