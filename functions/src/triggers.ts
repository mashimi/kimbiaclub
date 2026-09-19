import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue } from 'firebase-admin/firestore';
const db = admin.firestore();

export const onActivityCreated = onDocumentCreated(
  { document: 'activities/{activityId}', region: 'africa-south1' },
  async (event) => {
    const a = event.data?.data();
    if (!a) return;
    const ref = event.data!.ref;

    // Trust weighting: GPS-tracked runs count for the league
    if (['gps', 'strava'].includes(a.source)) await ref.update({ verified: true });

    if (a.clubId) {
      await db.doc(`clubs/${a.clubId}`).update({
        'stats.totalKm': FieldValue.increment((a.distanceM ?? 0) / 1000),
        'stats.runCount': FieldValue.increment(1),
        'stats.lastActivityAt': a.startedAt,
      }).catch(() => {});
    }

    // Course records (transaction — no lost updates)
    if (a.routeId && (a.durationS ?? 0) > 0) {
      const recRef = db.doc(`routes/${a.routeId}/records/${a.userId}`);
      await db.runTransaction(async (tx) => {
        const rec = await tx.get(recRef);
        if (!rec.exists || rec.data()!.timeS > a.durationS) {
          tx.set(recRef, { timeS: a.durationS,
            activityId: event.params.activityId, setAt: FieldValue.serverTimestamp() });
        }
      });
    }
  });

/** Free events confirm instantly. Paid ones wait for MANUAL admin confirmation. */
export const onRegistrationCreated = onDocumentCreated(
  { document: 'events/{eventId}/registrations/{regId}', region: 'africa-south1' },
  async (event) => {
    const ev = await db.doc(`events/${event.params.eventId}`).get();
    if (!ev.exists) return;
    if ((ev.data()!.feeTzs ?? 0) === 0) {
      await event.data!.ref.update({
        status: 'paid', amountPaid: 0, paidAt: FieldValue.serverTimestamp(),
      });
      await ev.ref.update({ registeredCount: FieldValue.increment(1) });
    }
  });

export const refreshWeeklyActive = onSchedule(
  { schedule: '0 4 * * *', timeZone: 'Africa/Dar_es_Salaam', region: 'africa-south1' },
  async () => {
    const weekAgo = new Date(Date.now() - 7 * 864e5);
    const clubs = await db.collection('clubs').select().get();
    for (const club of clubs.docs) {
      const snap = await db.collection('activities')
        .where('clubId', '==', club.id)
        .where('startedAt', '>=', weekAgo)
        .select('userId').get();
      await club.ref.update({
        'stats.last7Active': new Set(snap.docs.map(d => d.data().userId)).size,
      });
    }
  });
