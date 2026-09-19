// Extracts runs from a Google Timeline export (both formats), 100% in-browser.
export function extractRuns(jsonText) {
  let data;
  try { data = JSON.parse(jsonText); } catch { return []; }
  const segs = Array.isArray(data) ? data
    : (data.semanticSegments || []);
  const runs = [];
  for (const s of segs) {
    try {
      const act = s.activity;
      if (!act) continue;
      const type = act.topCandidate?.type;
      const start = new Date(s.startTime), end = new Date(s.endTime);
      const dist = Number(act.distanceMeters || 0);
      const secs = (end - start) / 1000;
      const speed = secs > 0 ? dist / secs : 0;
      const isRun = type === 'RUNNING' || (type === 'WALKING' && speed >= 2.0 && speed <= 4.5);
      if (isRun && dist >= 1500) runs.push({ start, end, distM: dist });
    } catch { /* skip malformed */ }
  }
  return runs.sort((a, b) => a.start - b.start);
}

// Builds a Timeline.json (semanticSegments) from the app's GPS runs → Recap Studio
export function runsToTimelineJson(runs) { // runs: [{points:[{lat,lng,t}], distanceM}]
  return JSON.stringify({ semanticSegments: runs.filter((r) => r.points?.length).map((r) => {
    const pts = r.points;
    const t0 = pts[0].t;
    return {
      startTime: new Date(t0).toISOString(),
      endTime: new Date(pts[pts.length - 1].t).toISOString(),
      activity: { topCandidate: { type: 'RUNNING', probability: 1 }, distanceMeters: r.distanceM },
      timelinePath: pts.map((p) => ({
        point: `${p.lat.toFixed(6)}°, ${p.lng.toFixed(6)}°`,
        durationMinutesOffset: String((p.t - t0) / 60000),
      })),
    };
  }) });
}
