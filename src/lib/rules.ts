import { gradeGap, isSfs } from "./grades";
import type { Bid, BidderRole, CycleStatus, ListOverride, Officer, Position, Post, RuleConfig } from "./types";

export const DEFAULT_RULES: RuleConfig = {
  cycleLabel: "2026–2027",
  onCycleStart: "2027-04",
  onCycleEnd: "2027-09",
  maxBidsOnCycle: 8,
  maxBidsOffCycle: 8,
  minAtGradeOnCycle: 4,
  minAtGradeOffCycle: 0,
  maxStretch: 2,
  maxStoop: 1,
  maxStretchBids: 8,
  maxDoubleStretchBids: 1,
  minRegions: 2,
  minHardshipBids: 1,
  hardshipThreshold: 20,
  allowSfsStretch: false,
  offCycleOnlyOffCycle: true,
  onCycleMayBidOffCycle: false,
  noSamePost: true,
  languageMode: "warn",
  matrixForOfficers: true,
};

export interface Lookup {
  postById: Map<string, Post>;
  positionById: Map<string, Position>;
  officerByPosition: Map<string, Officer>;
  incoming?: Map<string, Officer>; // position -> officer assigned there, now in language training
  overrides?: Map<string, ListOverride>; // admin edits to the bid list
  filled?: Set<string>; // positions an officer has been assigned to this cycle
}

export function cycleStatus(position: Position, lk: Lookup, rules: RuleConfig): CycleStatus {
  if (lk.filled?.has(position.id)) return "encumbered";
  const o = lk.overrides?.get(position.id);
  if (o === "remove") return "encumbered";
  const s = naturalStatus(position, lk, rules);
  return o === "add" && s === "encumbered" ? "on-cycle" : s;
}

/** Status from tour-end dates alone, before any admin edits to the list. */
export function naturalStatus(position: Position, lk: Lookup, rules: RuleConfig): CycleStatus {
  if (lk.incoming?.has(position.id)) return "encumbered"; // successor already assigned
  const inc = lk.officerByPosition.get(position.id);
  if (!inc || !inc.ted) return "vacant";
  if (inc.ted < rules.onCycleStart) return "off-cycle";
  if (inc.ted <= rules.onCycleEnd) return "on-cycle";
  return "encumbered";
}

export const onBidList = (s: CycleStatus) => s !== "encumbered";

export function bidderRole(officer: Officer, rules: RuleConfig): BidderRole {
  if (officer.training) return "not-bidding";
  if (!officer.positionId || !officer.ted) return "off-cycle";
  if (officer.ted < rules.onCycleStart) return "off-cycle";
  if (officer.ted <= rules.onCycleEnd) return "on-cycle";
  return "not-bidding";
}

export type Verdict = "ok" | "warn" | "blocked";

export interface Eligibility {
  verdict: Verdict;
  reasons: string[];
  gap: number; // + stretch, - stoop
}

const langName = (s: string) => s.replace(/\s*\d.*$/, "").trim().toLowerCase();

export function evaluate(officer: Officer, position: Position, lk: Lookup, rules: RuleConfig): Eligibility {
  const reasons: string[] = [];
  let verdict: Verdict = "ok";
  const block = (r: string) => {
    verdict = "blocked";
    reasons.push(r);
  };
  const warn = (r: string) => {
    if (verdict === "ok") verdict = "warn";
    reasons.push(r);
  };

  const status = cycleStatus(position, lk, rules);
  const role = bidderRole(officer, rules);
  const gap = gradeGap(officer.grade, position.grade);
  const current = officer.positionId ? lk.positionById.get(officer.positionId) : undefined;

  if (role === "not-bidding")
    block(officer.training ? "Already assigned (in language training)" : `Not bidding this cycle (TED ${officer.ted} is after ${rules.onCycleEnd})`);
  if (!onBidList(status)) block(`Not on the ${rules.cycleLabel} bid list`);
  if (officer.positionId === position.id) block("This is your current position");
  else if (rules.noSamePost && current && current.postId === position.postId) block("Consecutive tour at your current post");

  if (gap > 0) {
    if (!rules.allowSfsStretch && !isSfs(officer.grade) && isSfs(position.grade)) block("FS to SFS stretch is not allowed");
    else if (gap > rules.maxStretch) block(`Stretch of ${gap} grades exceeds the limit of ${rules.maxStretch}`);
  } else if (gap < 0 && -gap > rules.maxStoop) {
    block(`Stoop of ${-gap} grades exceeds the limit of ${rules.maxStoop}`);
  }

  if (role === "off-cycle" && rules.offCycleOnlyOffCycle && status === "on-cycle")
    block("Off-cycle bidders can bid only on vacant or off-cycle positions");
  if (role === "on-cycle" && !rules.onCycleMayBidOffCycle && (status === "vacant" || status === "off-cycle"))
    block("Opens before your TED; on-cycle bidders can't bid off-cycle positions");

  if (position.languageReq) {
    const has = officer.languages.some((l) => langName(l) === langName(position.languageReq!));
    if (!has) {
      const msg = `Language-designated: ${position.languageReq}, which you don't have`;
      if (rules.languageMode === "block") block(msg);
      else if (rules.languageMode === "warn") warn(`${msg} (training required)`);
    }
  }

  return { verdict, reasons, gap };
}

export interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

export function checkBidList(officer: Officer, bids: Bid[], lk: Lookup, rules: RuleConfig): Check[] {
  const role = bidderRole(officer, rules);
  const onCycle = role === "on-cycle";
  const max = onCycle ? rules.maxBidsOnCycle : rules.maxBidsOffCycle;
  const minAt = onCycle ? rules.minAtGradeOnCycle : rules.minAtGradeOffCycle;
  const evals = bids
    .map((b) => lk.positionById.get(b.positionId))
    .filter((p): p is Position => !!p)
    .map((p) => ({ p, e: evaluate(officer, p, lk, rules) }));
  const atGrade = evals.filter((x) => x.e.gap === 0).length;
  const stretches = evals.filter((x) => x.e.gap > 0).length;
  const doubles = evals.filter((x) => x.e.gap >= 2).length;
  const blocked = evals.filter((x) => x.e.verdict === "blocked");
  const posts = evals.map((x) => lk.postById.get(x.p.postId)!);
  const regions = new Set(posts.map((p) => p.region)).size;
  const hardship = posts.filter((p) => p.hardship >= rules.hardshipThreshold).length;

  const checks: Check[] = [
    { label: "Bid count", ok: bids.length > 0 && bids.length <= max, detail: `${bids.length} of ${max} allowed` },
  ];
  if (minAt > 0) checks.push({ label: "At-grade bids", ok: atGrade >= minAt, detail: `${atGrade} of ${minAt} required` });
  if (rules.maxStretchBids < max) checks.push({ label: "Stretch bids", ok: stretches <= rules.maxStretchBids, detail: `${stretches} of ${rules.maxStretchBids} allowed` });
  if (rules.maxStretch >= 2)
    checks.push({ label: "Double stretches", ok: doubles <= rules.maxDoubleStretchBids, detail: `${doubles} of ${rules.maxDoubleStretchBids} allowed` });
  if (onCycle && rules.minRegions > 1) checks.push({ label: "Regions", ok: regions >= rules.minRegions, detail: `${regions} of ${rules.minRegions} required` });
  if (onCycle && rules.minHardshipBids > 0)
    checks.push({ label: `${rules.hardshipThreshold}%+ hardship`, ok: hardship >= rules.minHardshipBids, detail: `${hardship} of ${rules.minHardshipBids} required` });
  checks.push({
    label: "Every bid eligible",
    ok: blocked.length === 0,
    detail: blocked.length ? `${blocked.length} bid${blocked.length > 1 ? "s" : ""} break a rule` : "No rule violations",
  });
  return checks;
}
