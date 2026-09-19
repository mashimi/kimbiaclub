import { db, auth, storage } from '../firebase-init.js';
import { collection, doc, addDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { h, TZ_CITIES, toast } from '../ui.js';
import { state } from '../app.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TAGS = ['social', 'competitive', 'beginner-friendly', 'trail', 'wellness', 'charity', 'youth', 'grassroots'];

export function renderCreateClub(view) {
  view.innerHTML = '';
  const name = h('input', { placeholder: 'e.g. Mwanza Trail Blazers' });
  const city = h('select', {}, TZ_CITIES.map((c) => h('option', { value: c }, c)));
  const hq = h('input', { placeholder: 'e.g. Tips Coco, Coco Beach' });
  const time = h('input', { type: 'time', value: '06:00' });
  const type = h('input', { placeholder: 'e.g. social 8K / timed 5K challenge' });
  const days = new Set(['Sat']);
  const tags = new Set(['social']);
  const logo = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  let logoFile = null;
  logo.onchange = () => { logoFile = logo.files[0] || null; logoBtn.textContent = logoFile ? `✓ ${logoFile.name}` : 'Upload logo'; };
  const logoBtn = h('button', { class: 'btn secondary small', onclick: () => logo.click() }, 'Upload logo');
  const chipRow = (set, all) => h('div', { class: 'chips' }, all.map((t) =>
    h('span', { class: `chip ${set.has(t) ? 'on' : ''}`, onclick: (e) => {
      set.has(t) ? set.delete(t) : set.add(t);
      e.target.classList.toggle('on');
    } }, t)));
  const err = h('div', { class: 'error' });
  const save = h('button', { class: 'btn', style: 'margin-top:10px' }, 'Create club 🚀');

  save.onclick = async () => {
    if (name.value.trim().length < 3) { err.textContent = 'Club name too short.'; return; }
    save.disabled = true;
    try {
      const clubRef = await addDoc(collection(db, 'clubs'), {
        name: name.value.trim(),
        slug: name.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        city: city.value, ownerId: auth.currentUser.uid,
        claimed: true, verified: false, tier: 'free',
        memberCount: 1,
        meetingInfo: { hq: hq.value.trim() || null,
          schedule: [{ days: [...days], time: time.value, type: type.value.trim() }],
          payTo: null },
        focusTags: [...tags], links: {},
        stats: { totalKm: 0, runCount: 0, last7Active: 1 },
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'clubs', clubRef.id, 'members', auth.currentUser.uid), {
        role: 'owner', status: 'active', userId: auth.currentUser.uid,
        displayName: state.profile?.displayName || 'Owner', joinedAt: serverTimestamp(),
      });
      if (logoFile) {
        try {
          const url = await getDownloadURL(await uploadBytes(
            sRef(storage, `clubs/${clubRef.id}/logo.png`), logoFile));
          await updateDoc(clubRef, { logoUrl: url });
        } catch (uploadErr) {
          // Firebase Storage requires the Blaze plan on new projects —
          // create the club anyway, just without the logo.
          toast('Club created — logo upload skipped (Storage needs the Blaze plan)');
        }
      }
      toast('Club created! 🎉');
      location.hash = `#/admin/${clubRef.id}`;
    } catch (e) { err.textContent = e.message; save.disabled = false; }
  };

  view.append(h('h1', {}, 'Register your club'),
    h('p', { class: 'muted', style: 'margin-bottom:20px' }, 'Free forever. You become the owner.'),
    h('label', { class: 'field' }, h('span', {}, 'Club name *'), name),
    h('label', { class: 'field' }, h('span', {}, 'City *'), city),
    h('label', { class: 'field' }, h('span', {}, 'Meeting point'), hq),
    h('div', { class: 'row' },
      h('label', { class: 'field', style: 'flex:1' }, h('span', {}, 'Start time'), time),
      h('label', { class: 'field', style: 'flex:2' }, h('span', {}, 'Run type'), type)),
    h('span', { class: 'field' }, h('span', {}, 'Days'), chipRow(days, DAYS)),
    h('span', { class: 'field' }, h('span', {}, 'Vibe tags'), chipRow(tags, TAGS)),
    h('div', { class: 'row' }, logoBtn, h('span', { class: 'muted', style: 'font-size:12px' }, 'Optional')),
    logo, err, save);
}
