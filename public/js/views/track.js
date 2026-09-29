import { db, auth } from '../firebase-init.js';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { h, toast, Fmt } from '../ui.js';
import { bumpClubStats } from '../stats.js';
import { state } from '../app.js';
import { fetchWeather } from '../weather.js';

const hav = (a, b) => {
  const R = 6371000, rad = (x) => x * Math.PI / 180;
  const dLa = rad(b.lat - a.lat), dLo = rad(b.lng - a.lng);
  const s = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

export function renderTrack(view) {
  view.innerHTML = '';
  if (!('geolocation' in navigator)) {
    view.append(h('p', { class: 'error' }, 'This device/browser has no GPS support.'));
    return;
  }

  let watch = null, started = null, pausedAt = null, pausedTotal = 0;
  let points = [], dist = 0, running = false, clubId = null, weatherData = null;

  const dEl = h('b', {}, '0.00'), tEl = h('b', {}, '00:00:00'), pEl = h('b', {}, '--');
  const ctrlRow = h('div', { class: 'row', style: 'margin-top:18px' });
  const statusBanner = h('div', { id: 'gps-status-banner' });
  const weatherBanner = h('div', { id: 'track-weather-banner', style: 'margin-top:14px' });

  const timer = setInterval(() => {
    if (!started) return;
    const elapsed = ((running ? Date.now() : pausedAt) - started - pausedTotal) / 1000;
    tEl.textContent = Fmt.dur(elapsed);
    dEl.textContent = (dist / 1000).toFixed(2);
    pEl.textContent = dist > 5 && elapsed > 0 ? Fmt.pace(elapsed / (dist / 1000)) : '--';
  }, 1000);

  const paint = () => {
    dEl.textContent = (dist / 1000).toFixed(2);
    ctrlRow.innerHTML = '';
    if (!running && !started) {
      ctrlRow.append(h('button', { class: 'btn', onclick: start }, '▶ START RUN'));
    } else {
      ctrlRow.append(
        h('button', { class: 'btn secondary', onclick: () => running ? pause() : resume() },
          running ? '⏸ Pause' : '▶ Resume'),
        h('button', { class: 'btn danger', onclick: finish }, '■ Finish'));
    }
  };

  function handleGpsError(err) {
    statusBanner.innerHTML = '';
    let msg = 'Location permission denied. Please allow location access in your phone/browser settings.';
    let actionTip = 'Tap the lock/settings icon near your browser address bar → Location → Allow.';
    
    if (err.code === 1) { // PERMISSION_DENIED
      msg = 'Location Permission Denied';
      actionTip = 'Your phone or browser blocked location access for Kimbia TZ. Tap the lock icon in your address bar or open Phone Settings → Apps → Chrome/Browser → Permissions → Allow Location.';
    } else if (err.code === 2) { // POSITION_UNAVAILABLE
      msg = 'GPS Signal Searching...';
      actionTip = 'Make sure your phone\'s Location/GPS is turned ON in system settings.';
    } else if (err.code === 3) { // TIMEOUT
      msg = 'GPS Timeout';
      actionTip = 'Moving outdoors away from tall buildings helps acquire a faster GPS lock.';
    }

    statusBanner.append(h('div', { class: 'card', style: 'background: rgba(255,82,82,0.1); border: 1px solid var(--red); padding: 14px; margin-top: 14px; text-align: left;' },
      h('div', { style: 'display: flex; gap: 10px; align-items: center;' },
        h('span', { style: 'font-size: 24px;' }, '📍'),
        h('div', { style: 'flex: 1;' },
          h('b', { style: 'color: var(--red); font-size: 14px; display: block;' }, msg),
          h('div', { style: 'font-size: 12px; color: var(--muted); margin-top: 2px;' }, actionTip)
        )
      ),
      h('button', {
        class: 'btn secondary small',
        style: 'margin-top: 10px; width: 100%;',
        onclick: () => { statusBanner.innerHTML = ''; start(); }
      }, '🔄 Retry GPS Lock')
    ));
  }

  function start() {
    statusBanner.innerHTML = '';
    toast('Requesting GPS lock & live weather...');
    
    navigator.geolocation.getCurrentPosition((p) => {
      const lat = p.coords.latitude, lng = p.coords.longitude;
      const initP = { lat, lng, t: Date.now() };
      points.push(initP);

      // Fetch Live Weather for runner's location
      fetchWeather(lat, lng, 'Current Location').then((w) => {
        weatherData = w;
        weatherBanner.innerHTML = '';
        weatherBanner.append(h('div', {
          class: 'card',
          style: 'background: rgba(0,200,83,0.08); border: 1px solid rgba(0,200,83,0.3); padding: 10px 14px; font-size: 13px; text-align: left; display: flex; align-items: center; justify-content: space-between;'
        },
          h('div', { class: 'row', style: 'gap: 8px;' },
            h('span', { style: 'font-size: 20px;' }, w.icon),
            h('div', {},
              h('b', { style: 'color: #fff;' }, `${w.temp}°C · ${w.condition}`),
              h('div', { class: 'muted', style: 'font-size: 11px;' }, `💨 Wind: ${w.windSpeed} km/h · 💧 Humidity: ${w.humidity}%`)
            )
          ),
          h('span', { style: 'font-size: 11px; font-weight: 700; color: var(--lime);' }, '🌤️ Live Weather')
        ));
      });

      watch = navigator.geolocation.watchPosition((pos) => {
        if (!running) return;
        const np = { lat: pos.coords.latitude, lng: pos.coords.longitude, t: Date.now() };
        const last = points[points.length - 1];
        if (last) {
          const seg = hav(last, np);
          if (seg > 90) return; // impossible jump — ignore
          dist += seg;
          dEl.textContent = (dist / 1000).toFixed(2);
        }
        points.push(np);
      }, (e) => toast('GPS: ' + (e.message || 'Signal lost')), { enableHighAccuracy: true, maximumAge: 2000 });
      
      started = Date.now(); running = true;
      toast('GPS Active! Tracking run… 🏃');
      paint();
    }, (err) => {
      handleGpsError(err);
    }, { enableHighAccuracy: true, timeout: 10000 });
  }

  function pause() { running = false; pausedAt = Date.now(); paint(); }
  function resume() { pausedTotal += Date.now() - pausedAt; running = true; paint(); }

  async function finish() {
    if (watch) navigator.geolocation.clearWatch(watch);
    clearInterval(timer);
    const elapsed = ((running ? Date.now() : pausedAt) - started - pausedTotal) / 1000;
    
    if (dist < 5 && elapsed < 5) {
      toast('Run too short to save');
      location.hash = '#/profile';
      return;
    }
    
    toast('Saving run activity...');
    
    // decimate to ~300 points
    const step = Math.max(1, Math.ceil(points.length / 300));
    const pts = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    
    try {
      await addDoc(collection(db, 'activities'), {
        userId: auth.currentUser?.uid || 'guest',
        clubId: clubId || null,
        distanceM: Math.round(dist),
        durationS: Math.round(elapsed),
        startedAt: new Date(started),
        points: pts,
        source: 'gps',
        verified: true, // GPS runs are verified live
        weather: weatherData ? {
          temp: weatherData.temp,
          condition: weatherData.condition,
          icon: weatherData.icon,
          windSpeed: weatherData.windSpeed,
          humidity: weatherData.humidity
        } : null,
        createdAt: serverTimestamp(),
      });
      
      if (clubId) {
        await bumpClubStats(clubId, Math.round(dist));
      }
      
      toast(`Saved ${(dist / 1000).toFixed(2)} km ✅`);
      location.hash = '#/profile';
    } catch (err) {
      console.error('Error saving activity:', err);
      toast('Error saving run: ' + (err.message || 'Please check connection'));
    }
  }

  // Club Selector (load user's clubs & all active clubs)
  const clubSel = h('select', {}, h('option', { value: '' }, '👤 Solo run (no club)'));
  clubSel.onchange = () => { clubId = clubSel.value || null; };

  async function loadClubOptions() {
    clubSel.innerHTML = '';
    clubSel.append(h('option', { value: '' }, '👤 Solo run (no club)'));

    const userRoles = state.roles || {};
    const userClubIds = Object.keys(userRoles);

    if (userClubIds.length > 0) {
      const myGroup = h('optgroup', { label: '⭐ My Joined Clubs' });
      for (const [id, name] of Object.entries(userRoles)) {
        myGroup.append(h('option', { value: id }, `🏃 ${name}`));
      }
      clubSel.append(myGroup);
      // Auto-select runner's first club
      clubSel.value = userClubIds[0];
      clubId = userClubIds[0];
    }

    try {
      const snap = await getDocs(collection(db, 'clubs'));
      if (!snap.empty) {
        const otherGroup = h('optgroup', { label: userClubIds.length > 0 ? 'Other Clubs' : 'All Running Clubs' });
        snap.forEach((d) => {
          if (!userRoles[d.id]) {
            const data = d.data();
            otherGroup.append(h('option', { value: d.id }, `🏃 ${data.name || 'Club'} (${data.city || 'Tanzania'})`));
          }
        });
        if (otherGroup.children.length > 0) {
          clubSel.append(otherGroup);
        }
      }
    } catch (e) {
      console.warn('Error loading clubs for tagging:', e);
    }
  }

  loadClubOptions();

  view.append(
    h('h1', {}, 'Track run'),
    h('p', { class: 'muted', style: 'margin-bottom:14px' },
      'GPS-tracked runs are ✅ verified and count for Club of the Month.'),
    h('label', { class: 'field' }, h('span', {}, 'Tag to club (optional)'), clubSel),
    h('div', { style: 'background:var(--surface);border:1px solid var(--outline);border-radius:22px;padding:26px;text-align:center' },
      h('div', {}, h('b', { class: 'stat-num', style: 'font-size:44px' }, dEl),
        h('small', { class: 'muted' }, ' KM')),
      h('div', { class: 'row', style: 'justify-content:center;margin-top:14px' },
        h('div', { style: 'flex:1' }, tEl, h('small', { class: 'muted' }, ' TIME')),
        h('div', { style: 'flex:1' }, pEl, h('small', { class: 'muted' }, ' PACE /KM'))),
      ctrlRow,
      weatherBanner,
      statusBanner));
  paint();
}
