import { bidderRole } from "./rules";
import type { Assignment, Officer, Round, RoundStatus, RuleConfig } from "./types";

export const DEFAULT_ROUNDS: Round[] = [
  {
    id: "r1",
    name: "Round 1 · On-cycle",
    roles: ["on-cycle"],
    grades: [],
    include: [],
    exclude: [],
    opensAt: "2026-09-21T09:00",
    closesAt: "2026-10-09T17:00",
    mode: "auto",
  },
  {
    id: "r2",
    name: "Round 2 · Off-cycle",
    roles: ["off-cycle"],
    grades: [],
    include: [],
    exclude: [],
    opensAt: "2026-10-19T09:00",
    closesAt: "2026-10-30T17:00",
    mode: "auto",
  },
];

export function roundStatus(r: Round, now = new Date()): RoundStatus {
  if (r.mode !== "auto") return r.mode;
  if (now < new Date(r.opensAt)) return "scheduled";
  if (now > new Date(r.closesAt)) return "closed";
  return "open";
}

export function inRound(o: Officer, r: Round, rules: RuleConfig, assigned?: Record<string, Assignment>): boolean {
  if (r.exclude.includes(o.id)) return false;
  // assigned officers are done: they don't bid in any round
  if (assigned?.[o.id]) return false;
  if (r.include.includes(o.id)) return true;
  const role = bidderRole(o, rules);
  if (role === "not-bidding" || !r.roles.includes(role)) return false;
  return r.grades.length === 0 || r.grades.includes(o.grade);
}

const fmt = (s: string) =>
  new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Only one round can be active. Among rounds that are open (manually or by
 * their dates), the earliest in the list wins; the rest wait.
 */
export function activeRound(rounds: Round[], now = new Date()): Round | null {
  return rounds.find((r) => roundStatus(r, now) === "open") ?? null;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
export { lowerFirst };

/** "Closes Oct 9, 5:00 PM", "Opens Oct 19, 9:00 AM", "Closed" */
export function windowLabel(r: Round, now = new Date()): string {
  const s = roundStatus(r, now);
  if (r.mode === "open") return "Opened manually";
  if (r.mode === "closed") return "Closed manually";
  return s === "scheduled" ? `Opens ${fmt(r.opensAt)}` : s === "open" ? `Closes ${fmt(r.closesAt)}` : `Closed ${fmt(r.closesAt)}`;
}
