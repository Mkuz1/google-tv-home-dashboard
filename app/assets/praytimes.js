// Offline prayer-time calculation (same astronomy as praytimes.org / Aladhan).
// prayerTimes(date, cfg) -> { fajr, sunrise, dhuhr, asr, maghrib, isha } as Date objects.
(function (root) {
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
  const dsin = (d) => Math.sin(rad(d));
  const dcos = (d) => Math.cos(rad(d));
  const dtan = (d) => Math.tan(rad(d));
  const darcsin = (x) => deg(Math.asin(x));
  const darccos = (x) => deg(Math.acos(x));
  const darctan2 = (y, x) => deg(Math.atan2(y, x));
  const darccot = (x) => deg(Math.atan(1 / x));

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  function sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = fix(357.529 + 0.98560028 * D, 360);
    const q = fix(280.459 + 0.98564736 * D, 360);
    const L = fix(q + 1.915 * dsin(g) + 0.02 * dsin(2 * g), 360);
    const e = 23.439 - 0.00000036 * D;
    const RA = darctan2(dcos(e) * dsin(L), dcos(L)) / 15;
    return { declination: darcsin(dsin(e) * dsin(L)), equation: q / 15 - fix(RA, 24) };
  }

  function prayerTimes(date, cfg) {
    const lat = cfg.latitude, lng = cfg.longitude;
    const p = cfg.prayer;
    // Timezone offset (hours) for this date in the configured zone.
    const tz = tzOffsetHours(date, cfg.timezone);
    const jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);

    const midDay = (t) => fix(12 - sunPosition(jd + t).equation, 24);
    const angleTime = (angle, t, ccw) => {
      const decl = sunPosition(jd + t).declination;
      const noon = midDay(t);
      const T = darccos((-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat))) / 15;
      return noon + (ccw ? -T : T);
    };
    const asrTime = (factor, t) => {
      const decl = sunPosition(jd + t).declination;
      return angleTime(-darccot(factor + dtan(Math.abs(lat - decl))), t);
    };

    // Two passes: first with rough day portions, then refined.
    let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
    for (let i = 0; i < 2; i++) {
      const dp = (h) => h / 24;
      t = {
        fajr: angleTime(p.fajrAngle, dp(t.fajr), true),
        sunrise: angleTime(0.833, dp(t.sunrise), true),
        dhuhr: midDay(dp(t.dhuhr)),
        asr: asrTime(p.asrFactor, dp(t.asr)),
        maghrib: angleTime(0.833, dp(t.maghrib)),
        isha: angleTime(p.ishaAngle, dp(t.isha)),
      };
    }

    // Some methods (e.g. Umm al-Qura) put Isha a fixed time after Maghrib instead of using an angle.
    if (p.ishaMinutes) t.isha = t.maghrib + p.ishaMinutes / 60;

    const out = {};
    for (const k of Object.keys(t)) {
      const hours = t[k] + tz - lng / 15 + (p.offsets[k] || 0) / 60;
      // Aladhan rounds to the nearest minute.
      const minutes = Math.round(hours * 60);
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      d.setMinutes(minutes);
      out[k] = d;
    }
    return out;
  }

  function tzOffsetHours(date, timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).formatToParts(date);
      const v = Object.fromEntries(parts.map((x) => [x.type, x.value]));
      const asUtc = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour % 24, +v.minute, +v.second);
      return Math.round((asUtc - date.getTime()) / 36e5 * 4) / 4;
    } catch (e) {
      return -date.getTimezoneOffset() / 60;
    }
  }

  root.prayerTimes = prayerTimes;
  if (typeof module !== "undefined") module.exports = { prayerTimes };
})(typeof window !== "undefined" ? window : globalThis);
