/* Lists Firebase Auth users and optionally sets the admin claim.
   Usage:
     set GOOGLE_APPLICATION_CREDENTIALS=<path-to-key.json>
     node admin-ops.js list
     node admin-ops.js setadmin <uid>
*/
const admin = require('firebase-admin');
admin.initializeApp();

const mode = process.argv[2];

if (mode === 'list') {
  admin.auth().listUsers(20)
    .then((res) => {
      if (!res.users.length) { console.log('NO_USERS_YET'); process.exit(0); }
      for (const u of res.users) {
        console.log(`uid=${u.uid} phone=${u.phoneNumber || '-'} email=${u.email || '-'} created=${u.metadata.creationTime}`);
      }
      process.exit(0);
    })
    .catch((e) => { console.error('ERR:', e.message); process.exit(1); });
} else if (mode === 'setadmin') {
  const uid = process.argv[3];
  if (!uid) { console.error('Usage: node admin-ops.js setadmin <uid>'); process.exit(1); }
  admin.auth().setCustomUserClaims(uid, { admin: true })
    .then(() => { console.log(`OK_ADMIN_SET uid=${uid}`); process.exit(0); })
    .catch((e) => { console.error('ERR:', e.message); process.exit(1); });
} else if (mode === 'setpassword') {
  const uid = process.argv[3];
  const arg = process.argv[4];
  if (!uid || !arg) { console.error('Usage: node admin-ops.js setpassword <uid> <newPassword|@file>'); process.exit(1); }
  const pw = arg.startsWith('@') ? require('fs').readFileSync(arg.slice(1), 'utf8').trim() : arg;
  admin.auth().updateUser(uid, { password: pw })
    .then(() => { console.log(`OK_PASSWORD_SET uid=${uid}`); process.exit(0); })
    .catch((e) => { console.error('ERR:', e.message); process.exit(1); });
} else if (mode === 'token') {
  // Mints a short-lived custom sign-in token (carries the user's stored claims).
  const uid = process.argv[3];
  if (!uid) { console.error('Usage: node admin-ops.js token <uid>'); process.exit(1); }
  admin.auth().createCustomToken(uid, { admin: true })
    .then((t) => { console.log(t); process.exit(0); })
    .catch((e) => { console.error('ERR:', e.message); process.exit(1); });
} else if (mode === 'deletebydomain') {
  // Deletes auth users whose email ends with the given domain, plus their profile docs.
  const domain = process.argv[3];
  if (!domain) { console.error('Usage: node admin-ops.js deletebydomain <@domain>'); process.exit(1); }
  (async () => {
    const res = await admin.auth().listUsers(100);
    const targets = res.users.filter((u) => u.email && u.email.endsWith(domain));
    for (const u of targets) {
      await admin.auth().deleteUser(u.uid);
      await admin.firestore().doc(`users/${u.uid}`).delete().catch(() => {});
      console.log(`deleted uid=${u.uid} email=${u.email}`);
    }
    if (!targets.length) console.log('NO_MATCHES');
    process.exit(0);
  })().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
} else {
  console.error('Usage: node admin-ops.js list|setadmin <uid>|deletebydomain <@domain>');
  process.exit(1);
}
