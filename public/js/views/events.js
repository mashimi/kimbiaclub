import { db, auth } from '../firebase-init.js';
import { collection, doc, onSnapshot, orderBy, query, where, limit,
  setDoc, serverTimestamp, getDoc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { h, Fmt, toast, openModal } from '../ui.js';
import { state } from '../app.js';

export function renderEvents(view) {
  view.innerHTML = '';
  view.append(h('h1', {}, 'Events'),
    h('p', { class: 'muted', style: 'margin-bottom:16px' }, 'Races & club runs across Tanzania'));
  const list = h('div');
  view.append(list);

  onSnapshot(query(collection(db, 'events'),
    where('startAt', '>=', Timestamp.now()), orderBy('startAt'), limit(50)),
    (snap) => {
      list.innerHTML = '';
      if (snap.empty) { list.append(h('div', { class: 'card' }, 'No upcoming events yet.')); return; }
      snap.forEach((d) => {
        const e = d.data();
        const start = e.startAt?.toDate?.() ?? new Date();
        const fee = e.feeTzs || 0;
        list.append(h('div', { class: 'tile', onclick: () => { location.hash = `#/events/${d.id}`; } },
          h('div', { style: 'text-align:center;min-width:52px;background:var(--surface-hi);border-radius:12px;padding:8px 4px' },
            h('b', { style: 'font-size:20px;color:var(--lime);display:block' }, String(start.getDate())),
            h('small', { class: 'faint' }, start.toLocaleString('en', { month: 'short' }).toUpperCase())),
          h('div', { class: 'grow' },
            h('b', {}, e.name || ''),
            h('small', {}, `${e.clubName || ''} · ${Fmt.dt(start)}${e.theme ? ` · 🎨 ${e.theme}` : ''}`)),
          h('span', { class: `badge ${fee ? 'wait' : 'ok'}` }, fee ? Fmt.tzs(fee) : 'FREE')));
      });
    });
}

export async function renderEventDetail(view, eventId) {
  view.innerHTML = '';
  const ref = doc(db, 'events', eventId);
  const evSnap = await getDoc(ref);
  if (!evSnap.exists()) { view.append(h('p', {}, 'Event not found.')); return; }
  const e = evSnap.data();
  const start = e.startAt?.toDate?.() ?? new Date();
  const fee = e.feeTzs || 0;
  const uid = auth.currentUser?.uid;
  let myReg = null;

  const statusBox = h('div', { style: 'margin:18px 0' });

  async function paint() {
    statusBox.innerHTML = '';
    if (!uid) {
      statusBox.append(h('a', { href: '#/home' }, h('button', { class: 'btn' }, 'Sign in to register')));
      return;
    }
    const regRef = doc(db, 'events', eventId, 'registrations', uid);
    const reg = await getDoc(regRef);
    myReg = reg.exists() ? reg.data() : null;

    if (myReg?.status === 'paid') {
      statusBox.append(h('button', { class: 'btn', disabled: true }, '✅ You\'re registered!'),
        h('p', { class: 'muted', style: 'text-align:center;margin-top:8px' }, 'See you at the start line 🏁'));
    } else if (myReg?.status === 'pending') {
      statusBox.append(h('button', { class: 'btn', disabled: true },
        fee ? '📲 Awaiting payment confirmation…' : 'Confirming…'));
      if (fee) statusBox.append(h('button', {
        class: 'btn secondary', style: 'margin-top:8px',
        onclick: async () => {
          await setDoc(regRef, { status: 'left' }, { merge: true });
          toast('Registration cancelled');
          paint();
        } }, 'Cancel registration'));
    } else if (myReg?.status === 'left' || !myReg) {
      statusBox.append(h('button', { class: 'btn', onclick: () => register() },
        fee ? `Register · ${Fmt.tzs(fee)}` : 'Register — Free'));
    }
  }

  async function register() {
    const regRef = doc(db, 'events', eventId, 'registrations', uid);
    if (!fee) {
      // No-Blaze mode: free events self-confirm instantly (rules allow status
      // 'paid' when the event's feeTzs is 0) and bump the counter client-side.
      await setDoc(regRef, { userId: uid, eventId, eventName: e.name,
        clubId: e.clubId, clubName: e.clubName, status: 'paid', amountPaid: 0,
        paidAt: serverTimestamp(), createdAt: serverTimestamp() });
      await updateDoc(doc(db, 'events', eventId),
        { registeredCount: increment(1) }).catch(() => {});
      toast('Registered! See you at the start line 🏁');
      paint();
      return;
    }
    // PAID event → manual payment modal
    const clubSnap = await getDoc(doc(db, 'clubs', e.clubId));
    const payTo = clubSnap.data()?.meetingInfo?.payTo;
    openModal((sheet, close) => {
      const payerPhone = h('input', { placeholder: '0712 345 678 (number you paid from)' });
      const txRef = h('input', { placeholder: 'Transaction reference (optional)' });
      sheet.append(
        h('h3', {}, `Pay ${Fmt.tzs(fee)}`),
        payTo
          ? h('div', { class: 'paybox' },
              h('small', { class: 'muted' }, `Send to ${payTo.network || 'Mobile Money'}:`),
              h('div', { class: 'num' }, payTo.number),
              payTo.name ? h('small', {}, `Name: ${payTo.name}`) : null)
          : h('div', { class: 'paybox' }, 'Contact the club for payment details.'),
        h('p', { class: 'muted', style: 'font-size:13px;margin-bottom:12px' },
          '1️⃣ Send the fee to the number above via M-Pesa/Airtel/Tigo. '
          + '2️⃣ Enter your details below. 3️⃣ The club confirms your payment — '
          + 'you\'ll see "Registered" once confirmed.'),
        h('label', { class: 'field' }, h('span', {}, 'Phone you paid from *'), payerPhone),
        h('label', { class: 'field' }, h('span', {}, 'Transaction reference'), txRef),
        h('button', { class: 'btn', onclick: async () => {
          if (!payerPhone.value.trim()) { toast('Enter the phone number you paid from'); return; }
          await setDoc(regRef, {
            userId: uid, eventId, eventName: e.name, clubId: e.clubId, clubName: e.clubName,
            status: 'pending', amountPaid: 0, feeTzs: fee,
            payerPhone: payerPhone.value.trim(), txRef: txRef.value.trim() || null,
            createdAt: serverTimestamp(),
          });
          close(); toast('Submitted! The club will confirm your payment 🙏');
          paint();
        } }, 'I\'ve paid — submit for confirmation'));
    });
  }

  view.append(
    h('h1', {}, e.name || 'Event'),
    e.theme ? h('span', { class: 'badge wait', style: 'display:inline-block;margin:6px 0' }, `🎨 ${e.theme}`) : null,
    h('div', { class: 'card', style: 'margin-top:14px' },
      h('div', { class: 'row', style: 'margin-bottom:8px' }, '📅 ', Fmt.dt(start)),
      h('div', { class: 'row', style: 'margin-bottom:8px' }, '👥 ', `${e.clubName || ''}`),
      e.meetingPoint ? h('div', { class: 'row', style: 'margin-bottom:8px' }, '📍 ', e.meetingPoint) : null,
      h('div', { class: 'row', style: 'margin-bottom:8px' }, '💵 ', fee ? Fmt.tzs(fee) : 'Free'),
      h('div', { class: 'row' }, '🙋 ', `${e.registeredCount ?? 0} registered`)),
    statusBox);
  paint();
}
