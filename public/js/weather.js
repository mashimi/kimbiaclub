/**
 * Kimbia TZ Weather Helper
 * Uses Open-Meteo API (Free, no API key required)
 */

const CITY_COORDS = {
  'Dar es Salaam': { lat: -6.7924, lng: 39.2083 },
  'Arusha': { lat: -3.3869, lng: 36.6830 },
  'Moshi': { lat: -3.3349, lng: 37.3404 },
  'Dodoma': { lat: -6.1630, lng: 35.7516 },
  'Mwanza': { lat: -2.5164, lng: 32.9175 },
  'Zanzibar': { lat: -6.1659, lng: 39.2026 },
  'Tanga': { lat: -5.0689, lng: 39.0988 },
  'MBeya': { lat: -8.9000, lng: 33.4500 },
  'Morogoro': { lat: -6.8278, lng: 37.6591 }
};

export function getWeatherMeta(code, windSpeed) {
  let condition = 'Clear Sky';
  let icon = '☀️';
  let tip = 'Great running conditions!';

  if (code === 0) {
    condition = 'Clear Sky'; icon = '☀️'; tip = 'Sunny & clear — wear sunscreen!';
  } else if (code >= 1 && code <= 3) {
    condition = 'Partly Cloudy'; icon = '⛅'; tip = 'Ideal running weather!';
  } else if (code === 45 || code === 48) {
    condition = 'Foggy'; icon = '🌫️'; tip = 'Low visibility — stay safe on roads.';
  } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    condition = 'Rainy'; icon = '🌧️'; tip = 'Wet roads — watch your traction!';
  } else if (code >= 95) {
    condition = 'Thunderstorm'; icon = '⛈️'; tip = 'Lightning warning — seek cover!';
  }

  if (windSpeed > 20) {
    icon = '💨';
    tip = `Breezy (${Math.round(windSpeed)} km/h wind) — push through!`;
  }

  return { condition, icon, tip };
}

export async function fetchWeather(lat = -6.7924, lng = 39.2083, cityName = 'Dar es Salaam') {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();
    const cur = data.current;
    
    const temp = Math.round(cur.temperature_2m);
    const humidity = cur.relative_humidity_2m;
    const windSpeed = Math.round(cur.wind_speed_10m);
    const code = cur.weather_code;
    const meta = getWeatherMeta(code, windSpeed);

    return {
      cityName,
      temp,
      humidity,
      windSpeed,
      code,
      condition: meta.condition,
      icon: meta.icon,
      tip: meta.tip,
    };
  } catch (err) {
    console.warn('Weather fetch error:', err);
    return {
      cityName,
      temp: 28,
      humidity: 75,
      windSpeed: 12,
      code: 1,
      condition: 'Partly Cloudy',
      icon: '⛅',
      tip: 'Warm tropical weather — drink water!',
    };
  }
}

export function getCityCoords(cityName) {
  return CITY_COORDS[cityName] || CITY_COORDS['Dar es Salaam'];
}
