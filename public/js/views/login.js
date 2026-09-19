import { auth } from '../firebase-init.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, RecaptchaVerifier, signInWithPhoneNumber,
} from 'firebase/auth';
import { h, toast } from '../ui.js';

let confirmation = null; // phone path (dormant — needs Blaze plan)

export function renderLogin(view) {
  view.innerHTML = '';
  const name = h('input', { placeholder: 'Your name', autocomplete: 'name' });
  const email = h('input', { type: 'email', placeholder: 'you@example.com', autocomplete: 'email' });
  const password = h('input', { type: 'password', placeholder: 'At least 6 characters',
    autocomplete: 'current-password' });
  const err = h('div', { class: 'error' });
  const btn = h('button', { class: 'btn' }, 'Sign in');
  const switchRow = h('p', { class: 'muted', style: 'text-align:center;font-size:13px;margin-top:16px' });
  let mode = 'signin'; // 'signin' | 'signup'

  const nameLabel = h('label', { class: 'field' }, h('span', {}, 'Your name'), name);
  const paint = () => {
    nameLabel.style.display = mode === 'signup' ? 'block' : 'none';
    btn.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
    switchRow.textContent = '';
    switchRow.append(mode === 'signup' ? 'Already have an account? ' : 'New to Kimbia? ');
    switchRow.append(h('a', { href: '#', style: 'color:var(--green);font-weight:700',
      onclick: (e) => { e.preventDefault(); err.textContent = '';
        mode = mode === 'signup' ? 'signin' : 'signup'; paint(); } },
      mode === 'signup' ? 'Sign in' : 'Create one'));
  };
  paint();

  btn.onclick = async () => {
    err.textContent = '';
    if (!email.value.trim() || password.value.length < 6) {
      err.textContent = 'Enter an email and a password of 6+ characters.'; return;
    }
    btn.disabled = true;
    try {
      if (mode === 'signup') {
        if (!name.value.trim()) { err.textContent = 'Enter your name.'; btn.disabled = false; return; }
        const cred = await createUserWithEmailAndPassword(auth, email.value.trim(), password.value);
        await updateProfile(cred.user, { displayName: name.value.trim() });
        // onAuthStateChanged takes over (creates the profile doc)
      } else {
        await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
      }
    } catch (e) {
      btn.disabled = false;
      const msg = {
        'auth/email-already-in-use': 'That email already has an account — sign in instead.',
        'auth/invalid-credential': 'Wrong email or password.',
        'auth/user-not-found': 'No account with that email — create one.',
        'auth/wrong-password': 'Wrong email or password.',
        'auth/operation-not-allowed': 'Email sign-in is not enabled yet — enable it in the Firebase console (Authentication → Sign-in method → Email/Password).',
      }[e.code] || e.message;
      err.textContent = msg;
    }
  };

  view.append(
    h('div', { style: 'text-align:center;padding-top:8vh' },
      h('div', { style: 'font-size:64px' }, '🏃'),
      h('h1', { style: 'letter-spacing:3px;margin-top:8px' }, 'KIMBIA TZ'),
      h('p', { class: 'muted' }, 'The league of Tanzanian running clubs'),
      h('div', { style: 'max-width:380px;margin:36px auto 0;text-align:left' },
        nameLabel,
        h('label', { class: 'field' }, h('span', {}, 'Email'), email),
        h('label', { class: 'field' }, h('span', {}, 'Password'), password),
        err,
        btn,
        switchRow,
        h('p', { class: 'faint', style: 'font-size:12px;margin-top:14px;text-align:center' },
          'Free forever. No phone number needed.'))),
  );
}
