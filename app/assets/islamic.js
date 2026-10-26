// Content for the phone's Islamic widgets: the 99 Names of Allah, verses of the day, the tasbih
// sequence and the Hijri occasions. a = Arabic, t = transliteration, m = meaning, r = reference.
window.ISLAMIC = (function () {
  const NAMES = [
    ["الرَّحْمَٰن", "Ar-Rahman", "The Most Merciful"], ["الرَّحِيم", "Ar-Rahim", "The Bestower of Mercy"],
    ["المَلِك", "Al-Malik", "The King"], ["القُدُّوس", "Al-Quddus", "The Most Holy"],
    ["السَّلَام", "As-Salam", "The Source of Peace"], ["المُؤْمِن", "Al-Mu'min", "The Giver of Security"],
    ["المُهَيْمِن", "Al-Muhaymin", "The Guardian"], ["العَزِيز", "Al-Aziz", "The Almighty"],
    ["الجَبَّار", "Al-Jabbar", "The Compeller"], ["المُتَكَبِّر", "Al-Mutakabbir", "The Supreme"],
    ["الخَالِق", "Al-Khaliq", "The Creator"], ["البَارِئ", "Al-Bari'", "The Maker"],
    ["المُصَوِّر", "Al-Musawwir", "The Fashioner"], ["الغَفَّار", "Al-Ghaffar", "The Ever-Forgiving"],
    ["القَهَّار", "Al-Qahhar", "The Subduer"], ["الوَهَّاب", "Al-Wahhab", "The Bestower"],
    ["الرَّزَّاق", "Ar-Razzaq", "The Provider"], ["الفَتَّاح", "Al-Fattah", "The Opener"],
    ["العَلِيم", "Al-Alim", "The All-Knowing"], ["القَابِض", "Al-Qabid", "The Withholder"],
    ["البَاسِط", "Al-Basit", "The Extender"], ["الخَافِض", "Al-Khafid", "The Abaser"],
    ["الرَّافِع", "Ar-Rafi'", "The Exalter"], ["المُعِزّ", "Al-Mu'izz", "The Giver of Honour"],
    ["المُذِلّ", "Al-Mudhill", "The Giver of Dishonour"], ["السَّمِيع", "As-Sami'", "The All-Hearing"],
    ["البَصِير", "Al-Basir", "The All-Seeing"], ["الحَكَم", "Al-Hakam", "The Judge"],
    ["العَدْل", "Al-Adl", "The Utterly Just"], ["اللَّطِيف", "Al-Latif", "The Subtle, the Kind"],
    ["الخَبِير", "Al-Khabir", "The All-Aware"], ["الحَلِيم", "Al-Halim", "The Forbearing"],
    ["العَظِيم", "Al-Azim", "The Magnificent"], ["الغَفُور", "Al-Ghafur", "The All-Forgiving"],
    ["الشَّكُور", "Ash-Shakur", "The Most Appreciative"], ["العَلِيّ", "Al-Aliyy", "The Most High"],
    ["الكَبِير", "Al-Kabir", "The Most Great"], ["الحَفِيظ", "Al-Hafiz", "The Preserver"],
    ["المُقِيت", "Al-Muqit", "The Sustainer"], ["الحَسِيب", "Al-Hasib", "The Reckoner"],
    ["الجَلِيل", "Al-Jalil", "The Majestic"], ["الكَرِيم", "Al-Karim", "The Most Generous"],
    ["الرَّقِيب", "Ar-Raqib", "The Watchful"], ["المُجِيب", "Al-Mujib", "The Responsive"],
    ["الوَاسِع", "Al-Wasi'", "The All-Encompassing"], ["الحَكِيم", "Al-Hakim", "The All-Wise"],
    ["الوَدُود", "Al-Wadud", "The Most Loving"], ["المَجِيد", "Al-Majid", "The Most Glorious"],
    ["البَاعِث", "Al-Ba'ith", "The Resurrector"], ["الشَّهِيد", "Ash-Shahid", "The Witness"],
    ["الحَقّ", "Al-Haqq", "The Truth"], ["الوَكِيل", "Al-Wakil", "The Trustee"],
    ["القَوِيّ", "Al-Qawiyy", "The All-Strong"], ["المَتِين", "Al-Matin", "The Firm"],
    ["الوَلِيّ", "Al-Waliyy", "The Protecting Friend"], ["الحَمِيد", "Al-Hamid", "The Praiseworthy"],
    ["المُحْصِي", "Al-Muhsi", "The Accounter"], ["المُبْدِئ", "Al-Mubdi'", "The Originator"],
    ["المُعِيد", "Al-Mu'id", "The Restorer"], ["المُحْيِي", "Al-Muhyi", "The Giver of Life"],
    ["المُمِيت", "Al-Mumit", "The Taker of Life"], ["الحَيّ", "Al-Hayy", "The Ever-Living"],
    ["القَيُّوم", "Al-Qayyum", "The Self-Sustaining"], ["الوَاجِد", "Al-Wajid", "The Finder"],
    ["المَاجِد", "Al-Majid", "The Noble"], ["الوَاحِد", "Al-Wahid", "The One"],
    ["الأَحَد", "Al-Ahad", "The Unique"], ["الصَّمَد", "As-Samad", "The Eternal Refuge"],
    ["القَادِر", "Al-Qadir", "The All-Able"], ["المُقْتَدِر", "Al-Muqtadir", "The All-Powerful"],
    ["المُقَدِّم", "Al-Muqaddim", "The Expediter"], ["المُؤَخِّر", "Al-Mu'akhkhir", "The Delayer"],
    ["الأَوَّل", "Al-Awwal", "The First"], ["الآخِر", "Al-Akhir", "The Last"],
    ["الظَّاهِر", "Az-Zahir", "The Manifest"], ["البَاطِن", "Al-Batin", "The Hidden"],
    ["الوَالِي", "Al-Wali", "The Governor"], ["المُتَعَالِي", "Al-Muta'ali", "The Most Exalted"],
    ["البَرّ", "Al-Barr", "The Source of Goodness"], ["التَّوَّاب", "At-Tawwab", "The Accepter of Repentance"],
    ["المُنْتَقِم", "Al-Muntaqim", "The Avenger"], ["العَفُوّ", "Al-Afuww", "The Pardoner"],
    ["الرَّؤُوف", "Ar-Ra'uf", "The Most Kind"], ["مَالِك المُلْك", "Malik al-Mulk", "Owner of All Sovereignty"],
    ["ذُو الجَلَال وَالإِكْرَام", "Dhul-Jalali wal-Ikram", "Lord of Majesty and Generosity"], ["المُقْسِط", "Al-Muqsit", "The Equitable"],
    ["الجَامِع", "Al-Jami'", "The Gatherer"], ["الغَنِيّ", "Al-Ghaniyy", "The Self-Sufficient"],
    ["المُغْنِي", "Al-Mughni", "The Enricher"], ["المَانِع", "Al-Mani'", "The Preventer"],
    ["الضَّار", "Ad-Darr", "The Distresser"], ["النَّافِع", "An-Nafi'", "The Benefactor"],
    ["النُّور", "An-Nur", "The Light"], ["الهَادِي", "Al-Hadi", "The Guide"],
    ["البَدِيع", "Al-Badi'", "The Incomparable Originator"], ["البَاقِي", "Al-Baqi", "The Everlasting"],
    ["الوَارِث", "Al-Warith", "The Inheritor"], ["الرَّشِيد", "Ar-Rashid", "The Guide to the Right Path"],
    ["الصَّبُور", "As-Sabur", "The Most Patient"],
  ].map(([a, t, m]) => ({ a, t, m }));

  const AYAT = [
    { a: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا", r: "الشرح ٥–٦", m: "So surely with hardship comes ease. Surely with hardship comes ease." },
    { a: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ", r: "الرعد ٢٨", m: "Surely in the remembrance of Allah do hearts find rest." },
    { a: "فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ", r: "البقرة ١٥٢", m: "So remember Me; I will remember you. Be grateful to Me and never deny Me." },
    { a: "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ", r: "الطلاق ٣", m: "Whoever puts their trust in Allah, He is enough for them." },
    { a: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا", r: "البقرة ٢٨٦", m: "Allah does not burden a soul beyond what it can bear." },
    { a: "وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ", r: "البقرة ١٨٦", m: "When My servants ask you about Me: I am truly near. I respond to the call of the caller when they call upon Me." },
    { a: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ", r: "البقرة ٢٠١", m: "Our Lord, give us good in this world and good in the Hereafter, and protect us from the torment of the Fire." },
    { a: "وَقُل رَّبِّ زِدْنِي عِلْمًا", r: "طه ١١٤", m: "And say: My Lord, increase me in knowledge." },
    { a: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", r: "البقرة ١٥٣", m: "Indeed, Allah is with the patient." },
    { a: "لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ", r: "إبراهيم ٧", m: "If you are grateful, I will surely give you more." },
    { a: "وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ", r: "يوسف ٨٧", m: "And do not lose hope in the mercy of Allah." },
    { a: "قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ", r: "الزمر ٥٣", m: "Say: O My servants who have wronged themselves, do not despair of the mercy of Allah." },
    { a: "وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ", r: "الحديد ٤", m: "And He is with you wherever you are." },
    { a: "ادْعُونِي أَسْتَجِبْ لَكُمْ", r: "غافر ٦٠", m: "Call upon Me; I will respond to you." },
    { a: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ", r: "آل عمران ١٧٣", m: "Allah is enough for us, and He is the best Disposer of affairs." },
    { a: "رَبِّ اشْرَحْ لِي صَدْرِي ۝ وَيَسِّرْ لِي أَمْرِي", r: "طه ٢٥–٢٦", m: "My Lord, open my heart for me, and make my task easy for me." },
    { a: "وَرَحْمَتِي وَسِعَتْ كُلَّ شَيْءٍ", r: "الأعراف ١٥٦", m: "And My mercy encompasses all things." },
    { a: "وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ", r: "الضحى ٥", m: "And your Lord is going to give you, and you will be content." },
    { a: "فَصَبْرٌ جَمِيلٌ", r: "يوسف ١٨", m: "So patience is most fitting." },
    { a: "وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ", r: "هود ٨٨", m: "My success comes only through Allah." },
    { a: "نَبِّئْ عِبَادِي أَنِّي أَنَا الْغَفُورُ الرَّحِيمُ", r: "الحجر ٤٩", m: "Tell My servants that I am the All-Forgiving, the Most Merciful." },
    { a: "وَاصْبِرْ فَإِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ", r: "هود ١١٥", m: "And be patient, for Allah does not let the reward of the good-doers be lost." },
    { a: "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً", r: "آل عمران ٨", m: "Our Lord, do not let our hearts deviate after You have guided us, and grant us mercy from Yourself." },
  ];

  // After each prayer: 33, 33, then 34 to make a hundred.
  const TASBIH = [
    { a: "سُبْحَانَ اللَّه", t: "SubhanAllah", n: 33 },
    { a: "الْحَمْدُ لِلَّه", t: "Alhamdulillah", n: 33 },
    { a: "اللَّهُ أَكْبَر", t: "Allahu Akbar", n: 34 },
  ];

  // Hijri day and month of a date (Umm al-Qura), or null where the calendar isn't available.
  let fmt = null;
  try { fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric" }); } catch (e) {}
  function hijri(d) {
    if (!fmt) return null;
    const p = {};
    for (const x of fmt.formatToParts(d)) p[x.type] = parseInt(x.value, 10);
    return p.day && p.month ? { d: p.day, m: p.month, y: p.year } : null;
  }
  const OCCASIONS = [
    { m: 9, d: 1, en: "Ramadan", ar: "رمضان" }, { m: 10, d: 1, en: "Eid al-Fitr", ar: "عيد الفطر" },
    { m: 12, d: 9, en: "Day of Arafah", ar: "يوم عرفة" }, { m: 12, d: 10, en: "Eid al-Adha", ar: "عيد الأضحى" },
    { m: 1, d: 1, en: "Islamic New Year", ar: "رأس السنة الهجرية" }, { m: 1, d: 10, en: "Ashura", ar: "عاشوراء" },
  ];
  // The coming occasions, soonest first, with how many days away (0 = today). Worked out once a day.
  let upKey = "", upList = [];
  function upcoming(t) {
    const key = t.toDateString();
    if (key === upKey) return upList;
    upKey = key; upList = [];
    const day = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 12);
    const seen = new Set();
    for (let i = 0; i < 360 && seen.size < OCCASIONS.length; i++) {
      const h = hijri(new Date(+day + i * 86400000));
      if (!h) break;
      const o = OCCASIONS.find((x) => x.m === h.m && x.d === h.d);
      if (o && !seen.has(o)) { seen.add(o); upList.push({ ...o, days: i }); }
    }
    return upList;
  }

  // Today's Sunnah reminders, most relevant first: [arabic, english].
  function reminders(t, today, tomorrow) {
    const out = [];
    const h = hijri(t), dow = t.getDay(), hm = t.getHours() * 60 + t.getMinutes();
    const tm = hijri(new Date(+t + 86400000));
    if (h && h.m === 9) out.push([`اليوم ${h.d} من رمضان · تقبّل الله صيامكم`, `Day ${h.d} of Ramadan`]);
    if (h && h.m === 12 && h.d === 9) out.push(["يوم عرفة · صيامه يكفّر سنتين", "Day of Arafah: a fast that expiates two years"]);
    else if (h && h.m === 12 && h.d < 9) out.push(["العشر من ذي الحجة · أكثروا من التكبير والعمل الصالح", "The first ten days of Dhul-Hijjah: say takbir, do good"]);
    if (h && h.m === 1 && (h.d === 9 || h.d === 10)) out.push(["صيام تاسوعاء وعاشوراء", "Fast of Tasu'a and Ashura"]);
    if (h && h.m === 10 && h.d > 1) out.push(["ست من شوال · من صامها مع رمضان كصيام الدهر", "Six days of Shawwal fasting"]);
    if (dow === 5 || (dow === 4 && today && t >= today.maghrib)) out.push(["الجمعة · سورة الكهف والصلاة على النبي ﷺ", "Friday: read Al-Kahf and send salawat"]);
    if (h && h.d >= 13 && h.d <= 15 && h.m !== 9) out.push([`الأيام البيض · صيام اليوم ${h.d}`, `White Days fast (${h.d}th)`]);
    else if (tm && tm.d === 13 && tm.m !== 9) out.push(["الأيام البيض تبدأ غداً", "White Days fast starts tomorrow"]);
    if ((dow === 1 || dow === 4) && !(h && h.m === 9)) out.push([dow === 1 ? "صيام الاثنين سنة" : "صيام الخميس سنة", dow === 1 ? "Monday: a Sunnah fast" : "Thursday: a Sunnah fast"]);
    else if ((dow === 0 || dow === 3) && !(tm && tm.m === 9)) out.push([dow === 0 ? "غداً الاثنين · نية الصيام" : "غداً الخميس · نية الصيام", dow === 0 ? "Tomorrow is Monday: Sunnah fast" : "Tomorrow is Thursday: Sunnah fast"]);
    if (today) {
      const mins = (d) => d.getHours() * 60 + d.getMinutes();
      if (hm >= mins(today.sunrise) + 20 && hm < mins(today.dhuhr) - 10) out.push(["وقت صلاة الضحى", "Time for the Duha prayer"]);
      const fajr = tomorrow ? tomorrow.fajr : null;
      if (fajr) {
        // The last third of the night, from Maghrib to Fajr.
        const nightStart = t < today.fajr ? new Date(+today.maghrib - 86400000) : today.maghrib;
        const nightEnd = t < today.fajr ? today.fajr : fajr;
        if (t >= +nightEnd - (nightEnd - nightStart) / 3 && t < nightEnd) out.push(["الثلث الأخير من الليل · وقت القيام والدعاء", "The last third of the night: time for Qiyam and dua"]);
      }
    }
    out.push(["اللهم صلِّ وسلم على نبينا محمد ﷺ", "Send blessings upon the Prophet ﷺ"]);
    return out;
  }

  return { NAMES, AYAT, TASBIH, hijri, upcoming, reminders };
})();
