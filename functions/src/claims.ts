import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
const db = admin.firestore();

/**
 * Lets a runner claim an unclaimed (platform-seeded) club and become its owner.
 * First-come, first-served, enforced transactionally.
 */
export const claimClub = onCall(
  { region: 'africa-south1' }, async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

    const clubId = req.data?.clubId;
    if (typeof clubId !== 'string' || !clubId) {
      throw new HttpsError('invalid-argument', 'clubId is required.');
    }

    const clubRef = db.doc(`clubs/${clubId}`);
    const name = await db.runTransaction(async (tx) => {
      const snap = await tx.get(clubRef);
      if (!snap.exists) throw new HttpsError('not-found', 'Club not found.');
      const data = snap.data()!;
      if (data.claimed === true && data.ownerId && data.ownerId !== uid) {
        throw new HttpsError('already-exists', 'This club has already been claimed.');
      }
      tx.update(clubRef, { claimed: true, ownerId: uid, tier: 'free' });
      tx.set(clubRef.collection('members').doc(uid), {
        role: 'owner', status: 'active', userId: uid,
        displayName: req.data?.displayName ?? 'Owner',
        joinedAt: FieldValue.serverTimestamp(),
      });
      return data.name ?? clubId;
    });

    return { ok: true, clubId, clubName: name };
  });
