import type { Grade } from "./types";

/** Lowest to highest. 01 -> OC is the FS / Senior Foreign Service threshold. */
export const GRADES: Grade[] = ["04", "03", "02", "01", "OC", "MC", "CM"];

export const GRADE_NAMES: Record<Grade, string> = {
  "04": "FS-04",
  "03": "FS-03",
  "02": "FS-02",
  "01": "FS-01",
  OC: "FE-OC · Counselor",
  MC: "FE-MC · Minister-Counselor",
  CM: "FE-CM · Career Minister",
};

export const gradeRank = (g: Grade) => GRADES.indexOf(g);
export const isSfs = (g: Grade) => gradeRank(g) >= gradeRank("OC");

/** Positive = position is above the officer (stretch), negative = stoop. */
export const gradeGap = (officer: Grade, position: Grade) => gradeRank(position) - gradeRank(officer);
