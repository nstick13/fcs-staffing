export type Grade = "04" | "03" | "02" | "01" | "OC" | "MC" | "CM";

export type Region =
  | "Middle East & Africa"
  | "Asia"
  | "Europe"
  | "Western Hemisphere"
  | "Washington"
  | "U.S. Field";

/** E = embassy, C = consulate, M = multilateral / MDB mission, H = headquarters, D = domestic field */
export type PostType = "E" | "C" | "M" | "H" | "D";

export interface Post {
  id: string;
  city: string;
  country: string;
  region: Region;
  subregion: string;
  lat: number;
  lng: number;
  type: PostType;
  hardship: number; // differential, percent
  language: string | null; // local language used for LDP positions
  tourYears: number;
}

export interface Position {
  id: string;
  postId: string;
  grade: Grade;
  title: string;
  specialty: string | null; // Standards, IPEF, Regional, ADB...
  languageReq: string | null; // e.g. "Japanese 3/3" when language-designated
}

export interface Officer {
  id: string;
  name: string;
  grade: Grade;
  languages: string[]; // e.g. ["Spanish 3/3"]
  positionId: string | null; // null = between assignments (training, LWOP return)
  ted: string | null; // tour end date, YYYY-MM
  lastHardship: number | null; // year of most recent 15%+ hardship tour
  /** In language training at FSI before an onward assignment */
  training: { language: string; until: string; onwardPositionId: string } | null;
}

export interface Bid {
  officerId: string;
  positionId: string;
  rank: number;
}

export type CycleStatus = "vacant" | "off-cycle" | "on-cycle" | "encumbered";
export type BidderRole = "on-cycle" | "off-cycle" | "not-bidding";

export interface RuleConfig {
  cycleLabel: string;
  onCycleStart: string; // YYYY-MM, TEDs in [start, end] are on-cycle
  onCycleEnd: string;
  maxBidsOnCycle: number;
  maxBidsOffCycle: number;
  minAtGradeOnCycle: number;
  minAtGradeOffCycle: number;
  maxStretch: number; // grades above own grade
  maxStoop: number; // grades below own grade
  maxStretchBids: number;
  maxDoubleStretchBids: number; // bids two grades up (an 04 on an 02)
  minRegions: number; // distinct regions on an on-cycle list
  minHardshipBids: number; // on-cycle bids at posts at or above the threshold
  hardshipThreshold: number; // percent
  allowSfsStretch: boolean; // may an 01 bid on OC+ positions
  offCycleOnlyOffCycle: boolean; // off-cycle bidders limited to off-cycle/vacant positions
  onCycleMayBidOffCycle: boolean; // on-cycle bidders may bid positions opening before the cycle
  noSamePost: boolean; // no consecutive tour at current post
  languageMode: "allow" | "warn" | "block"; // LDP positions without the language
  matrixForOfficers: boolean; // officers can see the bid matrix while bidding is on
}

/** Admin's manual changes to the bid list: force a position on, or take it off */
export type ListOverride = "add" | "remove";

export interface AppData {
  posts: Post[];
  positions: Position[];
  officers: Officer[];
  bids: Bid[];
  submitted: string[]; // officer ids whose bid list is submitted
}

/**
 * A bidding round: who may bid, and when. Membership comes from bidder type and
 * grade, adjusted by hand. `mode: "auto"` follows the window; open/closed override it.
 */
export interface Round {
  id: string;
  name: string;
  roles: Exclude<BidderRole, "not-bidding">[];
  grades: Grade[]; // empty = all grades
  include: string[]; // officer ids added by hand
  exclude: string[]; // officer ids removed by hand
  opensAt: string; // YYYY-MM-DDTHH:mm, local
  closesAt: string;
  mode: "auto" | "open" | "closed";
}

/** An officer placed this cycle, and the round it happened in */
export interface Assignment {
  positionId: string | null; // null = placed somewhere not on their list
  roundId: string | null;
}

export type RoundStatus = "scheduled" | "open" | "closed";
