import * as admin from 'firebase-admin';
admin.initializeApp();
export { claimClub } from './claims';
export { onActivityCreated, onRegistrationCreated, refreshWeeklyActive } from './triggers';
export { monthlyLeagueRollup, runLeagueRollupNow } from './league';
