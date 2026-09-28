/// Pure formatting helpers (ported from the web app's ui.js).
library;

import 'dart:math';

/// 1234 m -> "1.23 km", 950 m -> "950 m"
String fmtKm(num m) {
  if (m < 9.5) return '${m.round()} m';
  final km = m / 1000;
  return '${km.toStringAsFixed(m < 9950 ? 2 : 1)} km';
}

/// seconds per km -> "4:37" or '--'
String fmtPace(num secPerKm) {
  if (secPerKm <= 0 || !secPerKm.isFinite) return '--';
  final s = secPerKm.round();
  return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
}

/// seconds -> "00:45:12"
String fmtDur(num s) {
  final sec = s.round();
  final hh = sec ~/ 3600;
  final mm = (sec % 3600) ~/ 60;
  final ss = sec % 60;
  return '${hh.toString().padLeft(2, '0')}:${mm.toString().padLeft(2, '0')}:${ss.toString().padLeft(2, '0')}';
}

/// TZS with thousands separators: "TSh 350,000"
String fmtTzs(num n) {
  final digits = n.toStringAsFixed(0).split('');
  final buf = StringBuffer('TSh ');
  for (var i = 0; i < digits.length; i++) {
    buf.write(digits[i]);
    final remaining = digits.length - i - 1;
    if (remaining > 0 && remaining % 3 == 0) buf.write(',');
  }
  return buf.toString();
}

String _two(int n) => n.toString().padLeft(2, '0');

/// d/m/yyyy
String fmtDate(DateTime d) => '${d.day}/${d.month}/${d.year}';

/// "d/m/yyyy hh:mm"
String fmtDt(DateTime d) => '${fmtDate(d)} ${_two(d.hour)}:${_two(d.minute)}';

/// "5m ago" / "3h ago" / date for older
String fmtAgo(DateTime d) {
  final diffS = DateTime.now().difference(d).inSeconds;
  if (diffS < 3600) return '${max(1, diffS ~/ 60)}m ago';
  if (diffS < 86400) return '${diffS ~/ 3600}h ago';
  return fmtDate(d);
}

/// "2026-08" — the key of last month (or offset months from now).
String monthKey(int offsetMonths) => monthKeyAt(DateTime.now(), offsetMonths);

String monthKeyAt(DateTime now, int offsetMonths) {
  final d = DateTime(now.year, now.month + offsetMonths, 1);
  return '${d.year}-${_two(d.month)}';
}

const List<String> tzCities = [
  'Dar es Salaam', 'Arusha', 'Dodoma', 'Mwanza', 'Mbeya',
  'Zanzibar', 'Tanga', 'Moshi', 'Morogoro', 'Other',
];

const List<String> daysShort = [
  'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
];

const List<String> clubTags = [
  'social', 'competitive', 'beginner-friendly', 'trail',
  'wellness', 'charity', 'youth', 'grassroots',
];

const List<String> payNetworks = [
  'M-Pesa (Vodacom)', 'Mixx by Yas (Tigo)', 'Airtel Money', 'HaloPesa',
];