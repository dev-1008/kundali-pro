
// ─────────────────────────────────────────────────────────────
// ENTERPRISE-GRADE KUNDALI WORKER CORE (ZERO-DEPENDENCY)
// High-performance Meeus-lite astrology engine
// Safe for Cloudflare Worker / Wrangler
// Replace your ENTIRE existing top section with this
// (everything before export default)
// ─────────────────────────────────────────────────────────────


// ── Constants ────────────────────────────────────────────────
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const DEFAULT_AYANAMSA = 23.85; // Lahiri approximation


// ── Core Math Utilities ─────────────────────────────────────
function norm(deg) {
  return ((deg % 360) + 360) % 360;
}

function sinDeg(deg) {
  return Math.sin(deg * DEG2RAD);
}

function cosDeg(deg) {
  return Math.cos(deg * DEG2RAD);
}


// ── Julian Day Calculation ──────────────────────────────────
function jd(year, month, day, hourDecimal) {
  let y = year;
  let m = month;

  if (m <= 2) {
    y -= 1;
    m += 12;
  }

  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);

  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    B -
    1524.5 +
    hourDecimal / 24
  );
}


// ── Zodiac Signs ────────────────────────────────────────────
const RASHI = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces"
];


// ── Nakshatras ──────────────────────────────────────────────
const NAKSHATRAS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati"
];


// ── Zodiac Helpers ──────────────────────────────────────────
function rashi(longitude) {
  return Math.floor(norm(longitude) / 30);
}

function nakshatra(longitude) {
  const normalized = norm(longitude);
  const span = 360 / 27;
  const idx = Math.floor(normalized / span);
  const pada = Math.floor((normalized % span) / (span / 4)) + 1;

  return {
    idx,
    pada
  };
}


// ── Planetary Engine (Meeus-lite) ───────────────────────────
function calcPlanets(J, ayanamsa = DEFAULT_AYANAMSA) {
  const T = (J - 2451545.0) / 36525;
  const T2 = T * T;

  const ay = ayanamsa + T * 0.0136;

  // Sun
  const L0 = norm(280.46646 + 36000.76983 * T + 0.0003032 * T2);
  const M = norm(357.52911 + 35999.05029 * T - 0.0001537 * T2);

  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T2) * sinDeg(M) +
    (0.019993 - 0.000101 * T) * sinDeg(2 * M) +
    0.000289 * sinDeg(3 * M);

  const sunLongitude = norm(L0 + C - ay);

  // Moon
  const Lm = norm(218.3165 + 481267.8813 * T);
  const Mm = norm(134.9634 + 477198.8676 * T + 0.008997 * T2);
  const D = norm(297.8502 + 445267.1115 * T);

  const moonLongitude = norm(
    Lm +
      6.2888 * sinDeg(Mm) +
      1.2740 * sinDeg(2 * D - Mm) +
      0.6583 * sinDeg(2 * D) +
      0.2136 * sinDeg(2 * Mm) -
      0.1851 * sinDeg(M) -
      ay
  );

  return {
    Sun: {
      lon: sunLongitude,
      retro: false
    },
    Moon: {
      lon: moonLongitude,
      retro: false
    }
  };
}


// ── Lagna Engine ────────────────────────────────────────────
function calcLagna(J, latitude, longitude, ayanamsa = DEFAULT_AYANAMSA) {
  const T = (J - 2451545.0) / 36525;

  const RAMC = norm(
    280.46061837 +
      360.98564736629 * (J - 2451545) +
      0.000387933 * T * T +
      longitude
  );

  const latRad = latitude * DEG2RAD;
  const epsRad = (23.439291111 - 0.013004167 * T) * DEG2RAD;
  const ramcRad = RAMC * DEG2RAD;

  const ascendant = Math.atan2(
    cosDeg(RAMC),
    -(Math.sin(ramcRad) * Math.cos(epsRad) +
      Math.tan(latRad) * Math.sin(epsRad))
  );

  return norm(ascendant * RAD2DEG + 360 - ayanamsa);
}


// ── Primary Astro Processor ─────────────────────────────────
function getBasicAstro(dob, time, lat, lng, timezone) {
  if (!dob || !time) {
    throw new Error("Missing DOB or time");
  }

  const [year, month, day] = dob.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  if (
    !year ||
    !month ||
    !day ||
    hour === undefined ||
    minute === undefined
  ) {
    throw new Error("Invalid date or time format");
  }

  const julianDay = jd(
    year,
    month,
    day,
    hour + minute / 60 - timezone
  );

  const planets = calcPlanets(julianDay, DEFAULT_AYANAMSA);

  const lagnaLongitude = calcLagna(
    julianDay,
    Number(lat),
    Number(lng),
    DEFAULT_AYANAMSA
  );

  const moonNak = nakshatra(planets.Moon.lon);

  return {
    sunSign: RASHI[rashi(planets.Sun.lon)],
    moonSign: RASHI[rashi(planets.Moon.lon)],
    lagna: RASHI[rashi(lagnaLongitude)],
    nakshatra: NAKSHATRAS[moonNak.idx],
    pada: moonNak.pada,
    ayanamsa: "Lahiri"
  };
}
import SwissEphModule from "swisseph-wasm";

let _swe = null;

async function getSwe() {
  if (!_swe) {
    _swe = new SwissEphModule();
    await _swe.ready;
  }
  return _swe;
}

async function getSwissAstro(dob, time, lat, lng, timezone) {
  const SwissEph = await getSwe();

  const [year, month, day] = dob.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  const decimalHour = hour + minute / 60 - timezone;

  const julianDay = SwissEph.swe_julday(
    year,
    month,
    day,
    decimalHour,
    SwissEph.SE_GREG_CAL
  );

  // Lahiri Ayanamsa
  SwissEph.swe_set_sid_mode(
    SwissEph.SE_SIDM_LAHIRI,
    0,
    0
  );

  // Sun & Moon
  const sun = SwissEph.swe_calc_ut(
    julianDay,
    SwissEph.SE_SUN,
    SwissEph.SEFLG_SIDEREAL
  );

  const moon = SwissEph.swe_calc_ut(
    julianDay,
    SwissEph.SE_MOON,
    SwissEph.SEFLG_SIDEREAL
  );

  // Houses / Ascendant
  const houses = SwissEph.swe_houses_ex(
    julianDay,
    SwissEph.SEFLG_SIDEREAL,
    Number(lat),
    Number(lng),
    "P"
  );

  const lagnaLon = houses.ascmc[0];

  // Nakshatra
  const moonNak = nakshatra(moon.longitude);

  return {
    sunSign: RASHI[rashi(sun.longitude)],
    moonSign: RASHI[rashi(moon.longitude)],
    lagna: RASHI[rashi(lagnaLon)],
    nakshatra: NAKSHATRAS[moonNak.idx],
    pada: moonNak.pada,
    ayanamsa: "Lahiri (Swiss)"
  };
}
async function testSwe() {
  const swe = await getSwe();
  return Object.keys(swe).filter(k => typeof swe[k] === 'function');
}
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // API route
if (url.pathname === "/test-swe") {
  const keys = await testSwe();
  return new Response(JSON.stringify(keys), {
    headers: { "Content-Type": "application/json" }
  });
}
    if (url.pathname === "/api/kundali" && request.method === "POST") {
      try {
        const body = await request.json();

        const { name, dob, time, place, lat, lng, timezone } = body;

        if (
  !name ||
  !dob ||
  !time ||
  !place ||
  lat === undefined ||
  lng === undefined ||
  timezone === undefined
) {
          return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        }

        const datetime = `${dob}T${time}:00`;
        const dateObj = new Date(datetime);

        const response = {
          status: "success",
          name,
          birth: {
            date: dob,
            time: time,
            place,
            timestamp: dateObj.toISOString(),
            lat,
            lng,
            timezone
          },
         astro: await getSwissAstro(dob, time, lat, lng, timezone),
          message: "Kundali input processed successfully 🚀"
        };

        return new Response(JSON.stringify(response), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });

      } catch (err) {
        return new Response(
          JSON.stringify({ error: "Invalid request", details: err.message }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // Default route
    return new Response("Kundali Worker Running 🚀", {
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};