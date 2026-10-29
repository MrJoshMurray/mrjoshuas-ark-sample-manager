const K = 1024;
const BANK_SIZE = 128;
const MAX_STEM = 25;

const BANKS = {
  1: "Kick Drums",
  2: "Snares & Claps",
  3: "Hi-Hats & Cymbals",
  4: "Percussion & Toms",
  5: "Breakbeats & Drum Loops",
  6: "Vocal Samples & Cuts",
  7: "Bass & Synth Stabs",
  8: "Atmospheres, Pads & Drones",
};
const DEFAULT_TARGETS = { 1: 128, 2: 128, 3: 128, 4: 128, 5: 128, 6: 128, 7: 128, 8: 128 };

// [bank, match, [min bytes, max bytes], reject (file name only)]. First match wins.
const RULES = [
  [5, /amen|think|break|drum ?loop|beat ?loop|\bloop/, [150 * K, 3500 * K],
    /bass|synth|vocal|vox|pad|lead|chord|arp|guitar|piano|fx|roll|percussion|ride|hat|fill|stab/],
  [6, /vocal|vox|voice|acapella|acappella|speech|spoken|talk|phrase|choir|\bsing(?:er|ing)?\b|lyric|\bmc\b|shout|chant/,
    [8 * K, 2500 * K], /loop|bpm|synth/],
  [1, /kick|kik|\bbd\b|bassdrum|bass drum|_bd_/, [4 * K, 400 * K], /loop|bpm|break|\bpad\b/],
  [2, /snare|\bsn\b|\bsnr\b|clap|rim ?shot|snap|\bcp\b|\bsd\b|_sd_/, [4 * K, 400 * K], /loop|bpm|break/],
  [3, /hat|\bhh\b|\bch\b|\boh\b|cymbal|crash|ride|\bcr\b|\brd\b|splash/, [4 * K, 500 * K], /loop|bpm|break/],
  [4, /shaker|tamb|bongo|conga|\btom\b|toms|cowbell|clave|perc|timbale|agogo|wood ?block|cabasa|guiro|triangle|\bbell/,
    [4 * K, 400 * K], /loop|bpm|break/],
  [8, /atmos|ambien|\bpad\b|pads|drone|textur|field|soundscape|foley|noise|rain|wind|ocean|space|dark|swell|evolv|cinematic|eerie|haunt/,
    [300 * K, 8000 * K], /kick|snare|hat\b|clap/],
  [7, /bass|stab|acid|chord|synth|lead|\bsub\b|\bsub_|pluck|organ|piano|\bkey|riff|arp\b|303|reese|wobble/,
    [4 * K, 1500 * K], /loop|bpm|break|kick|drum/],
];

function classify(rel, size) {
  const low = rel.toLowerCase();
  const name = low.slice(low.lastIndexOf("/") + 1);
  for (const target of [name, low]) {
    for (const [bank, pat, [lo, hi], neg] of RULES) {
      if (size >= lo && size <= hi && pat.test(target) && !neg.test(name)) return bank;
    }
  }
  return null;
}

// Names that differ only by numbering (AHHH_1, AHHH_2, 03_AHHH) share a key. Longer numbers like 909 are kept.
function nameKey(path) {
  const base = path.slice(path.lastIndexOf("/") + 1).replace(/\.[^.]*$/, "").toLowerCase();
  let k = base.replace(/\(\d+\)/g, " ").replace(/^copy of /, "");
  let prev;
  do {
    prev = k;
    k = k.replace(/^\d{1,2}[\s_.-]+/, "").replace(/[\s_.-]+\d{1,2}$/, "").replace(/([a-z])\d{1,3}$/, "$1");
  } while (k !== prev);
  k = k.replace(/[\s_.()-]+/g, " ").trim();
  return k || base;
}

function cleanStem(path) {
  const base = path.slice(path.lastIndexOf("/") + 1).replace(/\.[^.]*$/, "");
  const stem = base.replace(/[^A-Za-z0-9+_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, MAX_STEM).replace(/_+$/, "");
  return stem || "sample";
}

// True for 16-bit, 44.1 kHz, mono/stereo PCM WAV. Reads only chunk headers.
async function isArkWav(file) {
  try {
    const u = async (o, n) => new DataView(await file.slice(o, o + n).arrayBuffer());
    const head = await u(0, 12);
    if (head.byteLength < 12 || head.getUint32(0) !== 0x52494646 || head.getUint32(8) !== 0x57415645) return false;
    let off = 12, fmt = null;
    for (let i = 0; i < 64; i++) {
      const c = await u(off, 8);
      if (c.byteLength < 8) return false;
      const id = c.getUint32(0), size = c.getUint32(4, true);
      if (id === 0x666d7420) { // "fmt "
        const f = await u(off + 8, 16);
        if (f.byteLength < 16) return false;
        fmt = { tag: f.getUint16(0, true), ch: f.getUint16(2, true), sr: f.getUint32(4, true), bits: f.getUint16(14, true) };
      } else if (id === 0x64617461) { // "data"
        return !!fmt && size > 0 && (fmt.tag === 1 || fmt.tag === 0xfffe) && (fmt.ch === 1 || fmt.ch === 2)
          && fmt.sr === 44100 && fmt.bits === 16;
      }
      off += 8 + size + (size & 1);
    }
    return false;
  } catch (e) {
    return false;
  }
}

function makeRng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
