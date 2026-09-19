import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { $, toast } from './ui.js';
import { renderLogin } from './views/login.js';
import { renderSetup } from './views/setup.js';
import { renderHome } from './views/home.js';
import { renderClubs, renderClubDetail } from './views/clubs.js';
import { renderCreateClub } from './views/createclub.js';
import { renderEvents, renderEventDetail } from './views/events.js';
import { renderProfile } from './views/profile.js';
import { renderLogRun } from './views/logrun.js';
import { renderTrack } from './views/track.js';
import { renderAdmin } from './views/admin.js';
import { renderPlatform } from './views/platform.js';
import { renderImport } from './views/import.js';

export const state = { user: null, profile: null, roles: {} };

const routes = [
  [/^#\/home$/, (v) => renderHome(v)],
  [/^#\/clubs$/, (v) => renderClubs(v)],
  [/^#\/clubs\/([\w-]+)$/, (v, m) => renderClubDetail(v, m[1])],
  [/^#\/create-club$/, (v) => renderCreateClub(v)],
  [/^#\/events$/, (v) => renderEvents(v)],
  [/^#\/events\/([\w-]+)$/, (v, m) => renderEventDetail(v, m[1])],
  [/^#\/profile$/, (v) => renderProfile(v)],
  [/^#\/log$/, (v) => renderLogRun(v)],
  [/^#\/track$/, (v) => renderTrack(v)],
  [/^#\/admin\/([\w-]+)$/, (v, m) => renderAdmin(v, m[1])],
  [/^#\/platform$/, (v) => renderPlatform(v)],
  [/^#\/import$/, (v) => renderImport(v)],
];

function route() {
  const view = $('#view');
  view.innerHTML = '';
  const hash = location.hash || '#/home';
  if (!state.user) { renderLogin(view); return; }
  if (!state.profile) { renderSetup(view); return; }

  for (const [re, fn] of routes) {
    const m = hash.match(re);
    if (m) { fn(view, m); paintNav(hash); return; }
  }
  location.hash = '#/home';
}

function paintNav(hash) {
  const nav = $('#bottomnav');
  nav.classList.remove('hidden');
  $('#topbar').classList.remove('hidden');
  for (const a of nav.querySelectorAll('a[data-route]')) {
    a.classList.toggle('active', hash.startsWith(`#/${a.dataset.route}`));
  }
}

/** Loads my active club memberships into state.roles as { clubId: clubName } */
async function loadRoles(user) {
  try {
    const snap = await getDocs(query(collectionGroup(db, 'members'),
      where('userId', '==', user.uid), where('status', '==', 'active')));
    const roles = {};
    for (const m of snap.docs) {
      const clubId = m.ref.parent.parent.id;
      const c = await getDoc(doc(db, 'clubs', clubId));
      roles[clubId] = c.exists() ? (c.data().name || 'Club') : 'Club';
    }
    state.roles = roles;
  } catch { state.roles = {}; }
}

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  state.profile = null;
  if (!user) {
    $('#bottomnav').classList.add('hidden');
    $('#topbar').classList.add('hidden');
    $('#topbar-right').innerHTML = '';
    renderLogin($('#view'));
    return;
  }
  // Ensure a user profile doc exists
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    state.profile = snap.data();
  } else {
    await setDoc(ref, {
      displayName: user.displayName || 'Runner',
      homeCity: 'Dar es Salaam',
      createdAt: serverTimestamp(),
    });
    state.profile = { displayName: user.displayName || 'Runner', homeCity: 'Dar es Salaam' };
    toast('Karibu Kimbia TZ! 👋');
  }
  await loadRoles(user);
  $('#topbar-right').innerHTML = '';
  route();
});

window.addEventListener('hashchange', route);
