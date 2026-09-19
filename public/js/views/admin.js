import { db, auth } from '../firebase-init.js';
import { collection, collectionGroup, doc, onSnapshot, orderBy, query, where, limit, getDoc,
  updateDoc, setDoc, deleteDoc, addDoc, serverTimestamp, writeBatch, increment, Timestamp } from 'firebase/firestore';
import { h, Fmt, toast, openModal, spinner } from '../ui.js';
import { state } from '../app.js';

export async function renderAdmin(view, clubId) {
  view.innerHTML = ''; view.append(spinner('Opening admin console…'));
  const roleSnap = await getDoc(doc(db, 'clubs', clubId, 'members', auth.currentUser.uid));
  const role = roleSnap.exists() ? roleSnap.data().role : null;
  if (!['owner', 'admin'].includes(role)) {
    view.innerHTML = '';
    view.append(h('div', { class: 'card', style: 'text-align:center;padding:40px' },
      h('h2', {}, '🔒 Admin access only'), h('p', { class: 'muted' }, 'Ask the club owner for admin rights.')));
    return;
  }

  const clubSnap = await getDoc(doc(db, 'clubs', clubId));
  const club = { id: clubSnap.id, ...clubSnap.data() };
  view.innerHTML = '';

  const tabs = ['Overview', 'Members', 'Events', 'Payments'];
  const tabBar = h('div', { class: 'tabs' }, tabs.map((t, i) =>
    h('button', { class: i === 0 ? 'on' : '', onclick: (e) => {
      tabBar.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
      e.target.classList.add('on');
      body.innerHTML = ''; [overview, members, eventsTab, payments][i]();
    } }, t)));
  const body = h('div');
  view.append(
    h('div', { class: 'spread' },
      h('h1', {}, club.name), h('span', { class: `badge ${club.tier === 'pro' ? 'wait' : 'ok'}` },
        club.tier === 'pro' ? 'PRO ⭐' : 'FREE')),
    tabBar, body);

  // ─── Overview ───
  function overview() {
    body.append(
      h('div', { class: 'grid2' },
        stat(club.memberCount, 'Members'), stat(club.stats?.last7Active ?? 0, 'Active this week'),
        stat(`${Math.round(club.stats?.totalKm ?? 0)} km`, 'Total distance'), stat(club.tier.toUpperCase(), 'Plan')),
      h('div', { class: 'spread', style: 'margin-top:20px' },
        h('h2', { style: 'margin:0' }, '📢 Announcements'),
        h('button', { class: 'btn small', onclick: () => announceModal() }, '+ New')),
      h('div', { id: 'anns' }));
    onSnapshot(query(collection(db, 'clubs', clubId, 'announcements'),
      orderBy('createdAt', 'desc'), limit(20)), (snap) => {
      const el = body.querySelector('#anns'); el.innerHTML = '';
      snap.forEach((d) => el.append(h('div', { class: 'card' },
        h('div', {}, d.data().text),
        h('small', { class: 'faint' }, Fmt.ago(d.data().createdAt?.toDate?.())))));
    });
  }
  function stat(v, l) { return h('div', { class: 'bigstat', style: 'background:var(--surface);border:1px solid var(--outline);border-radius:16px' }, h('b', { class: 'stat-num' }, String(v)), h('small', { class: 'muted' }, l.toUpperCase())); }

  function announceModal() {
    openModal((sheet, close) => {
      const text = h('textarea', { rows: '3', placeholder: 'Saturday 6AM — Tips Coco! All Black 🖤' });
      sheet.append(h('h3', {}, 'Broadcast to members'), text,
        h('button', { class: 'btn', onclick: async () => {
          if (!text.value.trim()) return;
          await addDoc(collection(db, 'clubs', clubId, 'announcements'),
            { text: text.value.trim(), createdAt: serverTimestamp() });
          close(); toast('Sent 📢');
        } }, 'Send'));
    });
  }

  // ─── Members ───
  function members() {
    body.append(h('h2', {}, 'Pending approvals'), h('div', { id: 'pending' }),
      h('h2', {}, 'Active members'), h('div', { id: 'active' }));
    onSnapshot(query(collection(db, 'clubs', clubId, 'members'),
      where('status', '==', 'pending')), (snap) => {
      const el = body.querySelector('#pending'); el.innerHTML = '';
      if (snap.empty) el.append(h('p', { class: 'muted' }, 'No pending requests.'));
      snap.forEach((d) => el.append(h('div', { class: 'tile' },
        h('div', { class: 'av' }, '🙋'),
        h('div', { class: 'grow' }, h('b', {}, d.data().displayName || d.id)),
        h('button', { class: 'btn small', onclick: async () => {
          const b = writeBatch(db);
          b.update(d.ref, { status: 'active' });
          b.update(doc(db, 'clubs', clubId), { memberCount: increment(1) });
          await b.commit(); toast('Approved ✅');
        } }, 'Approve'))));
    });
    onSnapshot(query(collection(db, 'clubs', clubId, 'members'),
      where('status', '==', 'active'), orderBy('joinedAt', 'desc'), limit(200)), (snap) => {
      const el = body.querySelector('#active'); el.innerHTML = '';
      snap.forEach((d) => {
        const m = d.data();
        el.append(h('div', { class: 'tile' },
          h('div', { class: 'av' }, (m.displayName || '?')[0].toUpperCase()),
          h('div', { class: 'grow' }, h('b', {}, m.displayName || d.id),
            h('small', {}, m.role || 'member')),
          m.role === 'member' ? h('div', { class: 'row' },
            h('button', { class: 'btn secondary small', onclick: () =>
              updateDoc(d.ref, { role: 'admin' }).then(() => toast('Made admin')) }, 'Make admin'),
            h('button', { class: 'btn danger small', onclick: () =>
              deleteDoc(d.ref).then(() => toast('Removed')) }, '✕')) : null));
      });
    });
  }

  // ─── Events ───
  function eventsTab() {
    body.append(h('div', { class: 'spread' },
      h('h2', { style: 'margin:0' }, 'Your events'),
      h('button', { class: 'btn small', onclick: eventModal }, '+ Create')),
      h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn secondary small',
        onclick: payToModal }, '💳 Payment collection number')),
      h('div', { id: 'evs', style: 'margin-top:14px' }));
    onSnapshot(query(collection(db, 'events'), where('clubId', '==', clubId),
      orderBy('startAt', 'desc'), limit(50)), (snap) => {
      const el = body.querySelector('#evs'); el.innerHTML = '';
      if (snap.empty) el.append(h('p', { class: 'muted' }, 'No events yet.'));
      snap.forEach((d) => {
        const e = d.data();
        el.append(h('div', { class: 'tile', onclick: () => { location.hash = `#/events/${d.id}`; } },
          h('div', { class: 'av' }, '📅'),
          h('div', { class: 'grow' }, h('b', {}, e.name || ''),
            h('small', {}, `${Fmt.dt(e.startAt?.toDate?.())} · ${e.registeredCount ?? 0} registered`)),
          h('span', { class: `badge ${e.feeTzs ? 'wait' : 'ok'}` }, e.feeTzs ? Fmt.tzs(e.feeTzs) : 'FREE')));
      });
    });
  }

  function payToModal() {
    openModal((sheet, close) => {
      const cur = club.meetingInfo?.payTo || {};
      const num = h('input', { value: cur.number || '', placeholder: '0712 345 678' });
      const net = h('select', {}, ['M-Pesa (Vodacom)', 'Mixx by Yas (Tigo)', 'Airtel Money', 'HaloPesa']
        .map((n) => h('option', { value: n, selected: cur.network === n || null }, n)));
      const nm = h('input', { value: cur.name || club.name || '', placeholder: 'Account name' });
      sheet.append(h('h3', {}, 'Payment collection number'),
        h('p', { class: 'muted', style: 'font-size:13px;margin-bottom:12px' },
          'Paid event registrations will show this number. Members pay here, then you confirm in the Payments tab.'),
        h('label', { class: 'field' }, h('span', {}, 'Number *'), num),
        h('label', { class: 'field' }, h('span', {}, 'Network'), net),
        h('label', { class: 'field' }, h('span', {}, 'Account name'), nm),
        h('button', { class: 'btn', onclick: async () => {
          await updateDoc(doc(db, 'clubs', clubId), {
            'meetingInfo.payTo': { number: num.value.trim(), network: net.value, name: nm.value.trim() },
          });
          club.meetingInfo = { ...club.meetingInfo, payTo: { number: num.value.trim(), network: net.value, name: nm.value.trim() } };
          close(); toast('Saved 💳');
        } }, 'Save'));
    });
  }

  function eventModal() {
    openModal((sheet, close) => {
      const name = h('input', { placeholder: 'Saturday Sunrise 8K' });
      const theme = h('input', { placeholder: 'All Black 🖤 (optional)' });
      const point = h('input', { placeholder: 'Meeting point' });
      const date = h('input', { type: 'date', value: new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10) });
      const time = h('input', { type: 'time', value: '06:00' });
      const fee = h('input', { type: 'number', placeholder: '0 = free', value: '0' });
      sheet.append(h('h3', {}, 'Create event'),
        h('label', { class: 'field' }, h('span', {}, 'Event name *'), name),
        h('label', { class: 'field' }, h('span', {}, 'Theme'), theme),
        h('label', { class: 'field' }, h('span', {}, 'Meeting point'), point),
        h('div', { class: 'row' },
          h('label', { class: 'field', style: 'flex:1' }, h('span', {}, 'Date'), date),
          h('label', { class: 'field', style: 'flex:1' }, h('span', {}, 'Time'), time)),
        h('label', { class: 'field' }, h('span', {}, 'Entry fee (TZS)'), fee),
        h('button', { class: 'btn', onclick: async () => {
          if (!name.value.trim()) return;
          await addDoc(collection(db, 'events'), {
            clubId, clubName: club.name,
            name: name.value.trim(), theme: theme.value.trim() || null,
            startAt: Timestamp.fromDate(new Date(`${date.value}T${time.value}:00`)),
            meetingPoint: point.value.trim() || null,
            feeTzs: parseInt(fee.value, 10) || 0,
            registeredCount: 0, createdBy: auth.currentUser.uid,
            createdAt: serverTimestamp(),
          });
          close(); toast('Event published 📅');
        } }, 'Publish event'));
    });
  }

  // ─── Payments (manual verification) ───
  function payments() {
    body.append(
      h('h2', {}, 'Event payments awaiting confirmation'),
      h('p', { class: 'muted', style: 'font-size:13px' },
        'Check the payment in YOUR mobile money statement, then confirm.'),
      h('div', { id: 'regs' }),
      h('h2', {}, 'Pro upgrade'),
      h('div', { id: 'probox' }));
    proBox();
    onSnapshot(query(collectionGroup(db, 'registrations'),
      where('clubId', '==', clubId), where('status', '==', 'pending')), (snap) => {
      const el = body.querySelector('#regs'); el.innerHTML = '';
      const paid = snap.docs.filter((d) => (d.data().feeTzs ?? 0) > 0 || d.data().payerPhone);
      if (!paid.length) { el.append(h('p', { class: 'muted' }, 'No pending payments.')); return; }
      paid.forEach((d) => {
        const r = d.data();
        el.append(h('div', { class: 'tile' },
          h('div', { class: 'av' }, '💰'),
          h('div', { class: 'grow' },
            h('b', {}, r.eventName || 'Event'),
            h('small', {}, `${r.payerPhone || '?'} · ${r.txRef || 'no ref'} · ${Fmt.tzs(r.feeTzs ?? 0)}`)),
          h('div', { class: 'row' },
            h('button', { class: 'btn small', onclick: async () => {
              const b = writeBatch(db);
              b.update(d.ref, { status: 'paid', amountPaid: r.feeTzs ?? 0,
                paidAt: serverTimestamp(), confirmedBy: auth.currentUser.uid });
              b.update(doc(db, 'events', r.eventId), { registeredCount: increment(1) });
              await b.commit(); toast('Confirmed ✅');
            } }, '✅ Confirm'),
            h('button', { class: 'btn danger small', onclick: () =>
              updateDoc(d.ref, { status: 'rejected' }).then(() => toast('Rejected')) }, '✕'))));
      });
    });
  }

  async function proBox() {
    const el = body.querySelector('#probox');
    el.innerHTML = '';
    if (club.tier === 'pro') {
      el.append(h('div', { class: 'card' }, h('b', {}, 'Pro active ⭐'),
        h('div', { class: 'muted', style: 'font-size:13px' },
          `Valid until ${Fmt.date(club.paidUntil?.toDate?.())}. Renewal reminder comes by SMS.`)));
      return;
    }
    const cfg = (await getDoc(doc(db, 'config', 'payment'))).data();
    const upgradeBtn = h('button', { class: 'btn', style: 'margin-top:10px' }, 'I\'ve paid — submit');
    upgradeBtn.onclick = () => openModal((sheet, close) => {
      const phone = h('input', { placeholder: 'Phone you paid from' });
      const tx = h('input', { placeholder: 'Transaction reference' });
      const submitBtn = h('button', { class: 'btn' }, 'Submit payment for verification');
      submitBtn.onclick = async () => {
        await addDoc(collection(db, 'subrequests'), {
          clubId, clubName: club.name, amount: 350000,
          payerPhone: phone.value.trim(), txRef: tx.value.trim() || null,
          status: 'pending', submittedBy: auth.currentUser.uid,
          submittedAt: serverTimestamp(),
        });
        close(); toast('Submitted! We\'ll verify shortly 🙏');
      };
      sheet.append(h('h3', {}, 'Submit Pro payment'),
        h('p', { class: 'muted', style: 'font-size:13px' },
          'Pay TSh 350,000 to the number above, then submit. The Kimbia team verifies within 24h.'),
        h('label', { class: 'field' }, h('span', {}, 'Phone *'), phone),
        h('label', { class: 'field' }, h('span', {}, 'Transaction ref'), tx),
        submitBtn);
    });
    el.append(h('div', { class: 'card' },
      h('b', {}, 'Upgrade to Pro — TSh 350,000 / year'),
      cfg ? h('div', { class: 'paybox', style: 'margin-top:10px' },
        h('small', { class: 'muted' }, `Send to ${cfg.payToName || 'Kimbia TZ'}:`),
        h('div', { class: 'num' }, cfg.payToNumber || '')) : null,
      upgradeBtn));
  }
}
