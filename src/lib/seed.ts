/**
 * Deterministic mock data. Locations and staffing patterns come from the deck;
 * every person is invented. The same function feeds local mode and
 * scripts/export-seed.ts (which writes supabase/seed.sql).
 */
import { POST_ROWS } from "@/data/posts";
import { GRADES, gradeRank } from "./grades";
import { DEFAULT_RULES, bidderRole, cycleStatus, evaluate, onBidList, type Lookup } from "./rules";
import type { AppData, Bid, Grade, Officer, Position, Post } from "./types";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Avery", "Jordan", "Morgan", "Priya", "Mateo", "Lena", "Omar", "Grace", "Theo", "Nadia", "Caleb", "Imani", "Rowan", "Sofia", "Declan", "Mei", "Tariq", "Hazel", "Ezra", "Camila", "Felix", "Anika", "Silas", "Leila", "Marcus", "Ingrid", "Jonah", "Rosa", "Wesley", "Yara", "Dmitri", "Clara", "Rafael", "Noor", "Elliot", "Keiko", "Samir", "Beatrix", "Hugo", "Tamsin", "Kofi", "Vera", "August", "Esme", "Nikhil", "Paloma", "Quentin", "Saoirse", "Tobias", "Ximena", "Harriet", "Idris", "Juno", "Lucian", "Marisol", "Orla", "Ptolemy", "Renata", "Stellan", "Thandiwe"];
const LAST = ["Okafor", "Lindqvist", "Castellano", "Brandt", "Nakashima", "Ferreira", "Whitcombe", "Delacroix", "Haddad", "Sorensen", "Achterberg", "Montoya", "Kowalczyk", "Ashworth", "Varga", "Pellegrino", "Oyelaran", "Fairbanks", "Rahimi", "Thibodeaux", "Reyes-Castillo", "Ingersoll", "Mwangi", "Halvorsen", "Quintero", "Abernathy", "Sato", "Rousseau", "Novak", "Everly", "Karimi", "Beaumont", "Lachance", "Ortega", "Hollingsworth", "Adeyemi", "Strand", "Vasquez", "Pemberton", "Nair", "Galloway", "Ivanova", "Carrow", "Takeda", "Menon", "Blackwood", "Duarte", "Faulkner", "Iqbal", "Winslow", "Arbuckle", "Szabo", "Oduya", "Villanueva", "Engstrom", "Mistry", "Calloway", "Petrakis", "Ruiz-Baptiste", "Umeh"];
const EXTRA_LANGS = ["Spanish", "French", "Portuguese", "Mandarin", "Arabic", "German", "Russian", "Japanese", "Korean", "Italian"];
const HARD_LANGS = new Set(["Arabic", "Mandarin", "Cantonese", "Japanese", "Korean"]);

function postId(city: string, used: Set<string>) {
  const clean = city.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase();
  let id = clean.slice(0, 3);
  for (let i = 3; used.has(id) && i < clean.length; i++) id = clean.slice(0, 2) + clean[i];
  used.add(id);
  return id;
}

function titleFor(post: Post, grade: Grade, spec: string | null, idx: number, n: number, sorted: Grade[]): string {
  if (post.type === "H") {
    if (spec === "DDG") return "Deputy Director General";
    if (spec?.startsWith("DAS ")) return `Deputy Assistant Secretary, ${spec.slice(4)}`;
    if (spec?.startsWith("ED ")) return `Executive Director, ${spec.slice(3)}`;
    if (spec === "CDAS") return "Chief of Staff";
    if (spec === "Faculty") return "Faculty Advisor";
    return gradeRank(grade) >= gradeRank("01") ? `Office Director, ${spec}` : `Desk Officer, ${spec}`;
  }
  if (post.type === "D") return spec ? `Commercial Advisor (${spec.replace(" Commercial", "")})` : "Domestic Tour Officer";
  if (post.type === "M" && spec) return `Commercial Liaison, ${spec}`;
  if (idx === 0) {
    if (spec === "Regional") return "Regional Senior Commercial Officer";
    return post.type === "C" ? "Principal Commercial Officer" : "Senior Commercial Officer";
  }
  if (idx === 1 && n >= 3 && gradeRank(sorted[1]) >= gradeRank("01") && !spec) return "Deputy Senior Commercial Officer";
  if (spec === "Standards") return "Standards Attaché";
  if (spec === "IPEF") return "Commercial Officer (IPEF)";
  if (spec === "Regional") return "Regional Commercial Officer";
  if (spec === "IT") return "IT Specialist Officer";
  return "Commercial Officer";
}

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

export function generateSeed(seed = 2027): AppData {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const used = new Set<string>();
  const posts: Post[] = [];
  const positions: Position[] = [];

  for (const [city, country, region, subregion, lat, lng, type, hardship, language, pattern, id] of POST_ROWS) {
    const post: Post = {
      id: id ?? postId(city, used),
      city, country, region, subregion, lat, lng, type, hardship, language,
      tourYears: hardship >= 20 ? 2 : 3,
    };
    if (id) used.add(id);
    posts.push(post);
    const entries = pattern.split(",").map((e) => {
      const [g, spec] = e.split(":");
      return { grade: g as Grade, spec: spec ?? null };
    });
    entries.sort((a, b) => gradeRank(b.grade) - gradeRank(a.grade));
    const sorted = entries.map((e) => e.grade);
    const counts: Record<string, number> = {};
    entries.forEach((e, i) => {
      counts[e.grade] = (counts[e.grade] ?? 0) + 1;
      const ldpOdds = HARD_LANGS.has(language ?? "") ? 0.6 : 0.4;
      positions.push({
        id: `${post.id}-${e.grade}-${counts[e.grade]}`,
        postId: post.id,
        grade: e.grade,
        title: titleFor(post, e.grade, e.spec, i, entries.length, sorted),
        specialty: e.spec,
        languageReq: language && post.type !== "M" && r() < ldpOdds ? `${language} ${e.grade === "04" ? "2/2" : "3/3"}` : null,
      });
    });
  }

  const postById = new Map(posts.map((p) => [p.id, p]));
  const names = new Set<string>();
  const newName = () => {
    let n = "";
    do n = `${pick(FIRST)} ${pick(LAST)}`;
    while (names.has(n));
    names.add(n);
    return n;
  };

  const officers: Officer[] = [];
  let oid = 1;
  const nextId = () => `O${String(oid++).padStart(3, "0")}`;

  for (const pos of positions) {
    const post = postById.get(pos.postId)!;
    if (r() < (post.type === "H" ? 0.06 : 0.11)) continue; // vacant
    // 35% of officers serve out of grade, mostly stretches
    const roll = r();
    const shift = roll < 0.62 ? 0 : roll < 0.83 ? -1 : roll < 0.86 ? -2 : 1;
    const gi = Math.min(GRADES.length - 1, Math.max(0, gradeRank(pos.grade) + shift));
    const langs: string[] = [];
    if (pos.languageReq && r() < 0.9) langs.push(pos.languageReq);
    else if (post.language && r() < 0.5) langs.push(`${post.language} ${r() < 0.5 ? "2/2" : "3/3"}`);
    if (r() < 0.55) {
      const l = pick(EXTRA_LANGS);
      if (!langs.some((x) => x.startsWith(l))) langs.push(`${l} ${pick(["2/2", "3/3", "3/3", "4/4"])}`);
    }
    const t = r();
    const ted =
      t < 0.3 ? ym(2027, pick([4, 5, 6, 6, 7, 7, 7, 8, 8, 9])) // on-cycle
      : t < 0.4 ? pick([ym(2026, 11), ym(2026, 12), ym(2027, 1), ym(2027, 2), ym(2027, 3)]) // leaving early
      : ym(2027 + 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 12));
    officers.push({
      id: nextId(),
      name: newName(),
      grade: GRADES[gi],
      languages: langs,
      positionId: pos.id,
      ted,
      lastHardship: post.hardship >= 15 ? 2025 : r() < 0.45 ? 2015 + Math.floor(r() * 9) : null,
      training: null,
    });
  }

  // Between assignments: returning from long-term training, details, LWOP
  for (let i = 0; i < 9; i++) {
    officers.push({
      id: nextId(),
      name: newName(),
      grade: pick(["04", "03", "03", "02", "02", "01", "OC"] as Grade[]),
      languages: r() < 0.6 ? [`${pick(EXTRA_LANGS)} 3/3`] : [],
      positionId: null,
      ted: null,
      lastHardship: r() < 0.5 ? 2018 + Math.floor(r() * 6) : null,
      training: null,
    });
  }

  // Already assigned, now in language training: they replace an incumbent leaving on-cycle
  const byPos = new Map(officers.filter((o) => o.positionId).map((o) => [o.positionId!, o]));
  const ldp = positions.filter((p) => {
    const inc = byPos.get(p.id);
    return p.languageReq && inc?.ted && inc.ted >= DEFAULT_RULES.onCycleStart && inc.ted <= DEFAULT_RULES.onCycleEnd;
  });
  for (const pos of ldp.slice(0, 20)) {
    const inc = byPos.get(pos.id)!;
    const lang = pos.languageReq!;
    const [y, m] = inc.ted!.split("-").map(Number);
    officers.push({
      id: nextId(),
      name: newName(),
      grade: GRADES[Math.max(0, gradeRank(pos.grade) - (r() < 0.25 ? 1 : 0))],
      languages: r() < 0.5 ? [`${pick(EXTRA_LANGS.filter((l) => !lang.startsWith(l)))} 3/3`] : [],
      positionId: null,
      ted: null,
      lastHardship: r() < 0.5 ? 2019 + Math.floor(r() * 5) : null,
      training: { language: lang, until: ym(m > 1 ? y : y - 1, m > 1 ? m - 1 : 12), onwardPositionId: pos.id },
    });
  }

  // Simulated bids so demand shows up on the map. Most on-cycle bidders submit a
  // list that follows the rules; the rest are drafts the admin dashboard can chase.
  const lk: Lookup = {
    postById,
    positionById: new Map(positions.map((p) => [p.id, p])),
    officerByPosition: new Map(officers.filter((o) => o.positionId).map((o) => [o.positionId!, o])),
    incoming: new Map(officers.filter((o) => o.training).map((o) => [o.training!.onwardPositionId, o])),
  };
  const rules = DEFAULT_RULES;
  const open = positions.filter((p) => onBidList(cycleStatus(p, lk, rules)));
  const bids: Bid[] = [];
  const submitted: string[] = [];
  for (const o of officers) {
    const role = bidderRole(o, rules);
    if (role === "not-bidding") continue;
    type C = { p: Position; e: ReturnType<typeof evaluate>; post: Post; s: number };
    const scored: C[] = open
      .map((p) => ({ p, e: evaluate(o, p, lk, rules), post: postById.get(p.postId)! }))
      .filter((x) => x.e.verdict !== "blocked")
      .map((x) => {
        const appeal = (1 / (1 + x.post.hardship / 15)) * (x.e.gap === 0 ? 1.6 : 1) * (x.post.type === "H" ? 0.6 : 1);
        return { ...x, s: appeal * (0.3 + r()) };
      })
      .sort((a, b) => b.s - a.s);
    const cap = role === "on-cycle" ? rules.maxBidsOnCycle : rules.maxBidsOffCycle;
    const draft = r() < 0.22;
    let list: C[];
    if (draft || role === "off-cycle") {
      list = scored.slice(0, draft ? 2 + Math.floor(r() * 5) : 1 + Math.floor(r() * 4));
      if (!draft && list.length) submitted.push(o.id);
    } else {
      list = scored.filter((x) => x.e.gap === 0).slice(0, rules.minAtGradeOnCycle);
      const add = (x: C | undefined) => x && list.length < cap && !list.includes(x) && list.push(x);
      if (!list.some((x) => x.post.hardship >= rules.hardshipThreshold)) add(scored.find((x) => x.post.hardship >= rules.hardshipThreshold));
      if (new Set(list.map((x) => x.post.region)).size < rules.minRegions) add(scored.find((x) => !list.some((y) => y.post.region === x.post.region)));
      let doubles = list.filter((x) => x.e.gap >= 2).length;
      const target = 6 + Math.floor(r() * 3);
      for (const x of scored) {
        if (list.length >= target) break;
        if (list.includes(x)) continue;
        if (x.e.gap >= 2 && doubles >= rules.maxDoubleStretchBids) continue;
        if (x.e.gap >= 2) doubles++;
        list.push(x);
      }
      list.sort((a, b) => b.s - a.s);
      submitted.push(o.id);
    }
    list.forEach((x, i) => bids.push({ officerId: o.id, positionId: x.p.id, rank: i + 1 }));
  }

  return { posts, positions, officers, bids, submitted };
}
