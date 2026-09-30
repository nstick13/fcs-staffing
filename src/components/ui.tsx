"use client";

import type { CycleStatus, Grade } from "@/lib/types";
import type { Verdict } from "@/lib/rules";

export const GradeChip = ({ g }: { g: Grade }) => <span className={`gc g-${g}`}>{g}</span>;

const STATUS_LABEL: Record<CycleStatus, string> = {
  "on-cycle": "On-cycle",
  "off-cycle": "Off-cycle",
  vacant: "Vacant",
  encumbered: "Not on list",
};
export const statusLabel = (s: CycleStatus) => STATUS_LABEL[s];
export const StatusPill = ({ s }: { s: CycleStatus }) => <span className={`pill st-${s}`}>{STATUS_LABEL[s]}</span>;

const VERDICT_LABEL: Record<Verdict, string> = { ok: "Eligible", warn: "Eligible with training", blocked: "Not eligible" };
export const VerdictPill = ({ v }: { v: Verdict }) => <span className={`pill v-${v}`}>{VERDICT_LABEL[v]}</span>;

export const gapLabel = (gap: number) => (gap > 0 ? `Stretch +${gap}` : gap < 0 ? `Stoop ${gap}` : "At grade");

export const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
