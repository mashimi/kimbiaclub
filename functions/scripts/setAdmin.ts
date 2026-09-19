/**
 * Grants the platform-admin custom claim to a user.
 *
 * Usage:
 *   cd functions && npm run build
 *   node scripts/setAdmin.js <user-uid>
 *
 * Or with ts-node:
 *   npx ts-node scripts/setAdmin.ts <user-uid>
 */
import * as admin from 'firebase-admin';

// Point this at your service-account key JSON:
//   GOOGLE_APPLICATION_CREDENTIALS=path\to\serviceAccount.json npx ts-node scripts/setAdmin.ts <uid>
admin.initializeApp();

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: npx ts-node scripts/setAdmin.ts <user-uid>');
  process.exit(1);
}

admin.auth()
  .setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`OK — user ${uid} is now a platform admin.`);
    console.log('The user must sign out and sign back in for the claim to take effect.');
    process.exit(0);
  })
  .catch((err: Error) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
