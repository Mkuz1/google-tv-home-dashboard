// Pieces shared by the screensaver and the car home screen's Dashboard:
// time formatting, prayer names, weather icons and the day reminders.
window.DASH = (function () {
  function hm(d) {
    const h = d.getHours() % 12 || 12;
    return h + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  const ampm = (d) => (d.getHours() < 12 ? "AM" : "PM");
  const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

  const PRAYERS = [
    ["fajr", "Fajr", "الفجر"], ["sunrise", "Sunrise", "الشروق"], ["dhuhr", "Dhuhr", "الظهر"],
    ["asr", "Asr", "العصر"], ["maghrib", "Maghrib", "المغرب"], ["isha", "Isha", "العشاء"],
  ];

  // The next prayer after now (sunrise doesn't count): {key, name, time, minutes}.
  function nextPrayer(now, today, tomorrow) {
    let key = null, time = null;
    for (const [k] of PRAYERS) {
      if (k === "sunrise") continue;
      if (today[k] > now) { key = k; time = today[k]; break; }
    }
    if (!key) { key = "fajr"; time = tomorrow.fajr; }
    const minutes = Math.max(0, Math.ceil((time - now) / 60000));
    return { key, time, minutes, name: PRAYERS.find((p) => p[0] === key)[1] };
  }
  const inMinutes = (mins) => {
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${h ? h + "h " : ""}${m}m`;
  };

  const WMO = {
    0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow", 80: "Showers", 81: "Showers", 82: "Heavy showers",
    85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
  };
  function weatherIcon(code, day = true) {
    const sun = '<circle cx="32" cy="32" r="11" fill="#F5C66B"/><g stroke="#F5C66B" stroke-width="3.5" stroke-linecap="round"><path d="M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4.2 4.2M44.8 44.8 49 49M15 49l4.2-4.2M44.8 19.2 49 15"/></g>';
    const moon = '<path d="M40 12a20 20 0 1 0 12 30A17 17 0 0 1 40 12z" fill="#E9E4D6"/>';
    const cloud = (x = 0, y = 0, c = "#E6EBEE") => `<path transform="translate(${x} ${y})" d="M20 48h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 48z" fill="${c}"/>`;
    const drops = '<g stroke="#7EC3F2" stroke-width="3.5" stroke-linecap="round"><path d="M24 52l-3 7M34 52l-3 7M44 52l-3 7"/></g>';
    let g;
    if (code === 0 || code === 1) g = day ? sun : moon;
    else if (code === 2) g = `<g transform="translate(-8 -8) scale(.8)">${day ? sun : moon}</g>` + cloud(4, 4);
    else if (code === 3) g = cloud(-6, -6, "#AEB8BE") + cloud(4, 2);
    else if (code === 45 || code === 48) g = '<g stroke="#C9D1D6" stroke-width="4" stroke-linecap="round"><path d="M12 24h40M8 34h48M14 44h36"/></g>';
    else if (code >= 95) g = cloud(0, -6, "#9AA6AD") + '<path d="M34 40l-8 12h7l-4 10 12-15h-7l4-7z" fill="#F5C66B"/>';
    else if ((code >= 71 && code <= 77) || code === 85 || code === 86) g = cloud(0, -6) + '<g fill="#FFFFFF"><circle cx="24" cy="54" r="3"/><circle cx="34" cy="58" r="3"/><circle cx="44" cy="54" r="3"/></g>';
    else g = cloud(0, -6) + drops;
    return `<svg viewBox="0 0 64 64">${g}</svg>`;
  }
  const weatherUrl = (C) => "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${C.latitude}&longitude=${C.longitude}&timezone=${encodeURIComponent(C.timezone)}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=5";
  const dayName = (isoDate, i) => {
    const [y, m, day] = isoDate.split("-").map(Number);
    return i === 0 ? "Today" : new Date(y, m - 1, day).toLocaleDateString("en-GB", { weekday: "short" });
  };

  // Day reminders: Friday (Al-Kahf, Thursday Maghrib to Friday Maghrib) and the white days.
  const BOOK = '<svg viewBox="0 0 24 24" fill="none" stroke="#FFE0A6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6c-2-1.5-5-2-8-1.5v14C7 18 10 18.5 12 20c2-1.5 5-2 8-1.5v-14C17 4 14 4.5 12 6zM12 6v14"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" fill="#FFE0A6"><path d="M14.5 3a9 9 0 1 0 6.5 15.2A7.5 7.5 0 0 1 14.5 3z"/></svg>';
  let hijriDayFmt, hijriMonthFmt;
  try {
    hijriDayFmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric" });
    hijriMonthFmt = new Intl.DateTimeFormat("ar-u-ca-islamic-umalqura", { month: "long" });
  } catch (e) {}
  function dayReminders(now, today, C) {
    const chips = [];
    const dow = now.getDay();
    if (C.reminders.kahf && ((dow === 4 && now >= today.maghrib) || (dow === 5 && now < today.maghrib))) {
      chips.push(`${BOOK}<span class="ar">الجمعة · سورة الكهف</span><span class="dot"></span><span class="en">Read Surat Al-Kahf</span>`);
    }
    if (C.reminders.whiteDays && hijriDayFmt) {
      const d = parseInt(hijriDayFmt.format(now), 10);
      const month = hijriMonthFmt.format(now);
      if (d >= 13 && d <= 15) {
        chips.push(`${MOON}<span class="ar">الأيام البيض · ${toArabicDigits(d)} ${month}</span><span class="dot"></span><span class="en">White Day fast (${d}th)</span>`);
      } else if (d === 12) {
        chips.push(`${MOON}<span class="ar">الأيام البيض تبدأ غداً</span><span class="dot"></span><span class="en">White Days fast starts tomorrow</span>`);
      }
    }
    return chips;
  }

  // The logo text with "&" drawn in gold.
  function logoHtml(text) {
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const mono = text.split("&").map(esc).join("<em>&amp;</em>");
    return `<span class="rule"></span><span class="mono">${mono}</span><span class="rule"></span>`;
  }

  return { hm, ampm, toArabicDigits, PRAYERS, nextPrayer, inMinutes, WMO, weatherIcon, weatherUrl, dayName, dayReminders, logoHtml };
})();
