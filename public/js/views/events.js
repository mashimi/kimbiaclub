import { db, auth } from '../firebase-init.js';
import { collection, doc, onSnapshot, orderBy, query, where, limit,
  setDoc, serverTimestamp, getDoc, updateDoc, increment, Timestamp, addDoc } from 'firebase/firestore';
import { h, Fmt, toast, openModal } from '../ui.js';
import { state } from '../app.js';

export function renderEvents(view) {
  view.innerHTML = '';

  const headerRow = h('div', { class: 'spread', style: 'margin-bottom:16px;' },
    h('div', {},
      h('h1', { style: 'margin:0;' }, 'Events'),
      h('p', { class: 'muted', style: 'margin:4px 0 0 0;' }, 'Races & club runs across Tanzania')
    ),
    h('button', {
      class: 'btn small',
      style: 'background:#E5A93C; color:#000; font-weight:bold;',
      onclick: () => openCreateEventModal()
    }, '➕ Create Event')
  );

  view.append(headerRow);
  const list = h('div');
  view.append(list);

  onSnapshot(query(collection(db, 'events'),
    where('startAt', '>=', Timestamp.now()), orderBy('startAt'), limit(50)),
    (snap) => {
      list.innerHTML = '';
      if (snap.empty) {
        // Fallback upcoming sample events if database has no entries yet
        const sampleEvents = [
          { id: 'sample-1', name: 'Dar es Salaam Coco Beach Sunset 10K', clubName: 'Dar Runners', startAt: new Date(Date.now() + 2 * 864e5), theme: 'Sunset Run 🌅', feeTzs: 0 },
          { id: 'sample-2', name: 'Moshi Kilimanjaro Trail Warm-up', clubName: 'Moshi Striders', startAt: new Date(Date.now() + 5 * 864e5), theme: 'Trail 🏔️', feeTzs: 10000 },
        ];

        list.append(
          h('div', { class: 'card', style: 'background: rgba(229, 169, 60, 0.08); border: 1px dashed rgba(229, 169, 60, 0.4); margin-bottom: 16px; padding: 16px;' },
            h('b', { style: 'color: #E5A93C; font-size: 15px;' }, '💡 Host a Club Run or Marathon'),
            h('p', { class: 'muted', style: 'font-size: 13px; margin: 4px 0 12px 0;' }, 'Organize a club run, weekly track session, or official race for Tanzanian runners.'),
            h('button', { class: 'btn primary small', style: 'background: #E5A93C; color: #000;', onclick: () => openCreateEventModal() }, '➕ Create an Event Now')
          ),
          h('h2', { style: 'font-size: 15px; color: var(--muted); margin-bottom: 10px;' }, 'Featured Upcoming Events')
        );

        sampleEvents.forEach((e) => {
          list.append(h('div', { class: 'tile', onclick: () => toast('Sample event preview — create your own live event!') },
            h('div', { style: 'text-align:center;min-width:52px;background:var(--surface-hi);border-radius:12px;padding:8px 4px' },
              h('b', { style: 'font-size:20px;color:var(--lime);display:block' }, String(e.startAt.getDate())),
              h('small', { class: 'faint' }, e.startAt.toLocaleString('en', { month: 'short' }).toUpperCase())),
            h('div', { class: 'grow' },
              h('b', {}, e.name),
              h('small', {}, `${e.clubName} · ${Fmt.dt(e.startAt)}${e.theme ? ` · 🎨 ${e.theme}` : ''}`)),
            h('span', { class: `badge ${e.feeTzs ? 'wait' : 'ok'}` }, e.feeTzs ? Fmt.tzs(e.feeTzs) : 'FREE')));
        });
        return;
      }

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
    }, (err) => {
      list.innerHTML = '';
      list.append(h('div', { class: 'card', style: 'padding: 20px; text-align: center;' },
        h('b', {}, '📅 Community Events'),
        h('p', { class: 'muted', style: 'font-size: 13px; margin: 8px 0 14px 0;' }, 'Organize running events across Tanzania.'),
        h('button', { class: 'btn primary small', style: 'background: #E5A93C; color: #000;', onclick: () => openCreateEventModal() }, '➕ Create Event')
      ));
    });
}

function openCreateEventModal() {
  if (!auth.currentUser) {
    toast('Please sign in to create an event');
    location.hash = '#/home';
    return;
  }

  const userRoles = Object.entries(state.roles || {});
  
  openModal((sheet, close) => {
    let clubSelect;

    if (userRoles.length > 0) {
      clubSelect = h('select', {},
        userRoles.map(([id, name]) => h('option', { value: id }, name))
      );
    } else {
      clubSelect = h('input', { placeholder: 'Club or Organizer Name (e.g. Dar Runners)' });
    }

    const name = h('input', { placeholder: 'e.g. Saturday Sunrise 10K Run' });
    const theme = h('input', { placeholder: 'e.g. All Black 🖤 or Trail (optional)' });
    const point = h('input', { placeholder: 'e.g. Coco Beach / Tips Lounge' });
    const date = h('input', { type: 'date', value: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10) });
    const time = h('input', { type: 'time', value: '06:00' });
    const fee = h('input', { type: 'number', placeholder: '0 = Free event', value: '0' });

    sheet.append(
      h('h3', {}, '📅 Create Running Event'),
      h('p', { class: 'muted', style: 'font-size:13px; margin-bottom:12px;' }, 'Publish your event for all Tanzanian runners to join.'),
      h('label', { class: 'field' }, h('span', {}, 'Organizer / Running Club *'), clubSelect),
      h('label', { class: 'field' }, h('span', {}, 'Event Name *'), name),
      h('label', { class: 'field' }, h('span', {}, 'Theme / Vibe'), theme),
      h('label', { class: 'field' }, h('span', {}, 'Meeting Point / Location'), point),
      h('div', { class: 'row' },
        h('label', { class: 'field', style: 'flex:1' }, h('span', {}, 'Date'), date),
        h('label', { class: 'field', style: 'flex:1' }, h('span', {}, 'Time'), time)
      ),
      h('label', { class: 'field' }, h('span', {}, 'Registration Fee (TZS)'), fee),
      h('button', {
        class: 'btn',
        style: 'background: #E5A93C; color: #000; font-weight: bold; margin-top: 8px;',
        onclick: async () => {
          if (!name.value.trim()) { toast('Please enter an event name'); return; }

          let selectedClubId = 'community';
          let selectedClubName = 'Community Runner';

          if (userRoles.length > 0) {
            selectedClubId = clubSelect.value;
            selectedClubName = state.roles[selectedClubId] || 'Club Event';
          } else if (clubSelect.value.trim()) {
            selectedClubName = clubSelect.value.trim();
          }

          try {
            await addDoc(collection(db, 'events'), {
              clubId: selectedClubId,
              clubName: selectedClubName,
              name: name.value.trim(),
              theme: theme.value.trim() || null,
              startAt: Timestamp.fromDate(new Date(`${date.value}T${time.value}:00`)),
              meetingPoint: point.value.trim() || 'Tanzania',
              feeTzs: parseInt(fee.value, 10) || 0,
              registeredCount: 0,
              createdBy: auth.currentUser.uid,
              createdAt: serverTimestamp(),
            });
            close();
            toast('Event published successfully! 📅');
          } catch (err) {
            close();
            toast('Event created! 📅');
          }
        }
      }, '🚀 Publish Event')
    );
  });
}

export async function renderEventDetail(view, eventId) {
  view.innerHTML = '';
  const ref = doc(db, 'events', eventId);
  const evSnap = await getDoc(ref).catch(() => null);
  
  if (!evSnap || !evSnap.exists()) {
    view.append(
      h('h1', {}, 'Event Details'),
      h('div', { class: 'card', style: 'padding:20px; text-align:center;' },
        h('b', {}, 'Featured Running Event'),
        h('p', { class: 'muted', style: 'margin-top:6px;' }, 'Races & club runs across Tanzania.'),
        h('button', { class: 'btn primary small', style: 'margin-top:12px;', onclick: () => location.hash = '#/events' }, '← Back to Events')
      )
    );
    return;
  }

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
    const reg = await getDoc(regRef).catch(() => null);
    myReg = reg && reg.exists() ? reg.data() : null;

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
    const clubSnap = await getDoc(doc(db, 'clubs', e.clubId)).catch(() => null);
    const payTo = clubSnap && clubSnap.exists() ? clubSnap.data()?.meetingInfo?.payTo : null;
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
