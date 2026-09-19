/* Provisions Firebase Storage without the console:
   1. creates GCS bucket <project>.firebasestorage.app
   2. grants the Firebase Storage + Firebase Rules service agents access
   3. registers the bucket with the Firebase Storage service
   Usage:
     set GOOGLE_APPLICATION_CREDENTIALS=<key.json>
     node provision-storage.js
*/
const fs = require('fs');
const path = require('path');
const { JWT } = require('google-auth-library');

const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const key = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
const PROJECT = key.project_id;

const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/devstorage.full_control',
  'https://www.googleapis.com/auth/firebase',
];

const client = new JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES });
const auth = async () => (await client.request({ url: 'https://www.googleapis.com/auth/cloud-platform' })).config.headers.Authorization;

async function api(method, url, body) {
  const res = await client.request({ url, method, data: body });
  return res.data;
}

(async () => {
  const BUCKET = `${PROJECT}.firebasestorage.app`;

  // 1. project number
  const proj = await api('GET', `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}`);
  const num = proj.projectNumber;
  console.log('PROJECT_OK', num);

  // 2. create bucket (US multi-region)
  try {
    await api('POST', 'https://storage.googleapis.com/storage/v1/b?project=' + PROJECT, {
      name: BUCKET, location: 'US', storageClass: 'STANDARD',
      iamConfiguration: { uniformBucketLevelAccess: { enabled: false } },
    });
    console.log('BUCKET_CREATED', BUCKET);
  } catch (e) {
    if (e.response && e.response.status === 409) console.log('BUCKET_EXISTS', BUCKET);
    else throw e;
  }

  // 3. IAM for Firebase service agents
  const policy = await api('GET', `https://storage.googleapis.com/storage/v1/b/${BUCKET}/iam`);
  const agents = [
    { role: 'roles/storage.objectAdmin', member: `serviceAccount:service-${num}@gcp-sa-firebasestorage.iam.gserviceaccount.com` },
    { role: 'roles/storage.objectViewer', member: `serviceAccount:service-${num}@firebase-rules.iam.gserviceaccount.com` },
  ];
  let changed = false;
  for (const a of agents) {
    const b = policy.bindings.find((x) => x.role === a.role);
    if (b && !b.members.includes(a.member)) { b.members.push(a.member); changed = true; }
    if (!b) { policy.bindings.push({ role: a.role, members: [a.member] }); changed = true; }
  }
  if (changed) {
    await api('PUT', `https://storage.googleapis.com/storage/v1/b/${BUCKET}/iam`, policy);
    console.log('IAM_SET');
  } else console.log('IAM_OK');

  // 4. register bucket with Firebase Storage
  try {
    await api('POST', `https://firebasestorage.googleapis.com/v1alpha/projects/${PROJECT}/buckets/${BUCKET}:addFirebase`);
    console.log('REGISTERED');
  } catch (e) {
    console.log('REGISTER_FALLBACK', e.response && e.response.status, (e.response && JSON.stringify(e.response.data)) || e.message);
  }
  console.log('DONE');
  process.exit(0);
})().catch((e) => {
  console.error('ERR:', (e.response && JSON.stringify(e.response.data)) || e.message);
  process.exit(1);
});
