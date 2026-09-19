import { db, auth } from '../firebase-init.js';
import { collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { h, toast, Fmt } from '../ui.js';
import { extractRuns, runsToTimelineJson } from '../timeline.js';

// Point this at your hosted fork of the Timeline Visualizer web build
const RECAP_STUDIO_URL = 'https://ahn-lab.org/google-timeline-visualizer/'; // or your self-hosted fork

export async function renderImport(view) {
  view.innerHTML = '';
  view.append(h('h1', {}, '⏪ Your running history'),
    h('p', { class: 'muted', style: 'margin-bottom:16px' },
      'Import your Google Timeline. Everything is processed in your browser — the file never leaves your phone.'));

  const file = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  const results = h('div');

  file.onchange = async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      const runs = extractRuns(await f.text());
      results.innerHTML = '';
      if (!runs.length) {
        results.append(h('div', { class: 'card' }, 'No runs detected in that file. '
          + 'Make sure it\'s a Timeline export (Phone Settings → Location → Timeline → Export).'));
        return;
      }
      results.append(h('p', { class: 'muted', style: 'margin-bottom:10px' },
        `Found ${runs.length} runs — ${Fmt.km(runs.reduce((s, r) => s + r.distM, 0))} total. `
        + 'These count as personal stats (not league scoring).'));
      const importBtn = h('button', { class: 'btn', onclick: async () => {
        importBtn.disabled = true;
        const batchOps = runs.map((r) => addDoc(collection(db, 'activities'), {
          userId: auth.currentUser.uid, clubId: null,
          distanceM: Math.round(r.distM),
          durationS: Math.round((r.end - r.start) / 1000),
          startedAt: r.start, source: 'timeline', verified: false,
          createdAt: serverTimestamp(),
        }));
        await Promise.all(batchOps);
        toast(`Imported ${runs.length} runs ✅`);
        location.hash = '#/profile';
      } }, `Import all ${runs.length} runs`);
      results.append(importBtn);
    } catch {
      results.innerHTML = '';
      results.append(h('div', { class: 'error' }, 'Could not read that file as Timeline JSON.'));
    }
  };

  // ── Recap Studio: turn MY GPS runs into a cinematic video ──
  const recapBtn = h('button', { class: 'btn secondary', style: 'margin-top:16px' }, '🎬 Recap Studio — make a video of my runs');
  recapBtn.onclick = async () => {
    const snap = await getDocs(query(collection(db, 'activities'),
      where('userId', '==', auth.currentUser.uid),
      where('source', '==', 'gps'), orderBy('startedAt', 'desc'), limit(20)));
    const runs = snap.docs.map((d) => d.data()).filter((r) => r.points?.length > 1);
    if (!runs.length) { toast('Track a GPS run first!'); return; }
    const blob = new Blob([runsToTimelineJson(runs)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob),
      download: `kimbia-runs-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    toast('Timeline file downloaded — now open Recap Studio and load it 🎬');
    setTimeout(() => window.open(RECAP_STUDIO_URL, '_blank', 'noopener'), 800);
  };

  view.append(
    h('div', { class: 'card' },
      h('b', {}, 'Step 1 — Export your Timeline'),
      h('p', { class: 'muted', style: 'font-size:13px;margin:8px 0 14px' },
        'Phone Settings → Location → Location services → Timeline → Export Timeline data. Save Timeline.json.'),
      h('button', { class: 'btn', onclick: () => file.click() }, 'Step 2 — Choose Timeline.json'),
      file),
    results,
    recapBtn);
}
