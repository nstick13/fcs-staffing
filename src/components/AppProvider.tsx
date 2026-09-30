"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { generateSeed } from "@/lib/seed";
import { DEFAULT_RULES, cycleStatus, type Lookup } from "@/lib/rules";
import { loadRemote } from "@/lib/supabase";
import { DEFAULT_ROUNDS, activeRound as pickActive, inRound, roundStatus } from "@/lib/rounds";
import type { AppData, Assignment, Bid, CycleStatus, Grade, ListOverride, Officer, Position, Post, Region, Round, RoundStatus, RuleConfig } from "@/lib/types";

export type View = "map" | "roster" | "columns" | "table" | "bidding" | "matrix" | "bidlist" | "admin";
export type Role = "viewer" | "officer" | "admin";
export type Selection = { kind: "position" | "post"; id: string } | null;

export interface Filters {
  q: string;
  regions: Region[];
  grades: Grade[];
  statuses: CycleStatus[];
}

const EMPTY_FILTERS: Filters = { q: "", regions: [], grades: [], statuses: [] };

function useStored<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // reading storage has to wait for mount; the server render has no localStorage
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setV({ ...initial, ...JSON.parse(raw) } as T);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (next: T | ((p: T) => T)) =>
      setV((p) => {
        const n = typeof next === "function" ? (next as (p: T) => T)(p) : next;
        try {
          localStorage.setItem(key, JSON.stringify(n));
        } catch {}
        return n;
      }),
    [key],
  );
  return [v, set] as const;
}

type BidEdits = Record<string, { bids: Bid[]; submitted: boolean }>;
type PositionEdits = { added: Position[]; deleted: string[]; overrides: Record<string, ListOverride> };
const NO_EDITS: PositionEdits = { added: [], deleted: [], overrides: {} };

interface Ctx {
  data: AppData;
  source: "local" | "supabase";
  lk: Lookup;
  rules: RuleConfig;
  setRules: (r: RuleConfig) => void;
  status: Map<string, CycleStatus>;
  bids: Bid[]; // seed bids with everyone's local edits applied
  bidsByPosition: Map<string, Bid[]>;
  bidsByOfficer: Map<string, Bid[]>;
  isSubmitted: (officerId: string) => boolean;
  view: View;
  setView: (v: View) => void;
  role: Role;
  setRole: (r: Role) => void;
  filters: Filters;
  setFilters: (f: Filters | ((p: Filters) => Filters)) => void;
  visible: Position[]; // after region/grade/status filters
  matches: Set<string> | null; // search hits among visible, null when no query
  selection: Selection;
  select: (s: Selection) => void;
  personaId: string;
  setPersonaId: (id: string) => void;
  persona: Officer;
  myBids: Bid[];
  setMyBids: (b: Bid[]) => void;
  submitted: boolean;
  setSubmitted: (b: boolean) => void;
  rounds: Round[];
  setRounds: (f: (r: Round[]) => Round[]) => void;
  roundState: Map<string, RoundStatus>;
  roundsFor: (o: Officer) => Round[];
  /** bid list posted: officers can browse it */
  biddingOn: boolean;
  setBiddingOn: (b: boolean) => void;
  /** the one round whose members can bid right now */
  active: Round | null;
  inActive: (o: Officer) => boolean;
  canBid: (officerId: string) => boolean;
  personaCanBid: boolean;
  /** show bidding UI: always for admins, for officers while the bid list is posted */
  showBidding: boolean;
  assigned: Record<string, Assignment>; // officers placed this cycle
  assign: (officerId: string, positionId: string | null, roundId: string | null) => void;
  unassign: (officerId: string) => void;
  seedPositions: Position[];
  edits: PositionEdits;
  setOverride: (positionId: string, o: ListOverride | null) => void;
  addPosition: (p: Position) => void;
  deletePosition: (positionId: string) => void;
  restorePosition: (positionId: string) => void;
  trainees: Officer[];
  resetDemo: () => void;
  postOf: (p: Position) => Post;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [base, setBase] = useState<AppData>(() => generateSeed());
  const [source, setSource] = useState<"local" | "supabase">("local");
  const [rules, setRules] = useStored<RuleConfig>("fcs.rules.v2", DEFAULT_RULES);
  const [prefs, setPrefs] = useStored("fcs.prefs.v2", { view: "map" as View, role: "officer" as Role, personaId: "" });
  const [bidEdits, setBidEdits] = useStored<BidEdits>("fcs.bids.v2", {});
  const [roundStore, setRoundStore] = useStored("fcs.rounds.v2", { rounds: DEFAULT_ROUNDS });
  const [bidding, setBidding] = useStored("fcs.bidding.v1", { on: true });
  const [assignStore, setAssignStore] = useStored<{ map: Record<string, Assignment> }>("fcs.assigned.v2", { map: {} });
  const assigned = assignStore.map;
  const rounds = roundStore.rounds;
  const setRounds = useCallback((f: (r: Round[]) => Round[]) => setRoundStore((s) => ({ rounds: f(s.rounds) })), [setRoundStore]);
  // round windows are live: re-check the clock every minute
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const roundState = useMemo(() => new Map(rounds.map((r) => [r.id, roundStatus(r, now)])), [rounds, now]);
  const [edits, setEdits] = useStored<PositionEdits>("fcs.positions.v1", NO_EDITS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selection, select] = useState<Selection>(null);

  useEffect(() => {
    loadRemote()
      .then((r) => {
        if (!r) return;
        setBase(r.data);
        setSource("supabase");
      })
      .catch((e) => console.error("Supabase load failed, staying on local seed", e));
  }, []);

  // positions after the admin's adds and deletes; bids on deleted positions drop out
  const data = useMemo<AppData>(() => {
    const gone = new Set(edits.deleted);
    const positions = [...base.positions.filter((p) => !gone.has(p.id)), ...edits.added];
    return { ...base, positions, bids: base.bids.filter((b) => !gone.has(b.positionId)) };
  }, [base, edits.added, edits.deleted]);

  const trainees = useMemo(() => data.officers.filter((o) => o.training), [data.officers]);
  const lk = useMemo<Lookup>(
    () => ({
      postById: new Map(data.posts.map((p) => [p.id, p])),
      positionById: new Map(data.positions.map((p) => [p.id, p])),
      officerByPosition: new Map(data.officers.filter((o) => o.positionId).map((o) => [o.positionId!, o])),
      incoming: new Map(trainees.map((o) => [o.training!.onwardPositionId, o])),
      overrides: new Map(Object.entries(edits.overrides)),
      filled: new Set(Object.values(assigned).map((a) => a.positionId).filter((x): x is string => !!x)),
    }),
    [data, trainees, edits.overrides, assigned],
  );
  const status = useMemo(() => new Map(data.positions.map((p) => [p.id, cycleStatus(p, lk, rules)])), [data, lk, rules]);

  const roundsFor = useCallback((o: Officer) => rounds.filter((r) => inRound(o, r, rules, assigned)), [rounds, rules, assigned]);
  const active = useMemo(() => (bidding.on ? pickActive(rounds, now) : null), [bidding.on, rounds, now]);
  const inActive = useCallback((o: Officer) => !!active && inRound(o, active, rules, assigned), [active, rules, assigned]);
  const canBidSet = useMemo(() => new Set(data.officers.filter(inActive).map((o) => o.id)), [data.officers, inActive]);
  const canBid = useCallback((id: string) => canBidSet.has(id), [canBidSet]);

  const defaultPersona = useMemo(() => {
    // an FS-02 who can bid right now makes the best demo
    const o = data.officers.find((o) => o.grade === "02" && canBidSet.has(o.id)) ?? data.officers.find((o) => o.positionId);
    return (o ?? data.officers[0]).id;
  }, [data, canBidSet]);
  const personaId = prefs.personaId && data.officers.some((o) => o.id === prefs.personaId) ? prefs.personaId : defaultPersona;
  const persona = data.officers.find((o) => o.id === personaId)!;

  const bids = useMemo(() => {
    const edited = new Set(Object.keys(bidEdits));
    const exists = new Set(data.positions.map((p) => p.id));
    // assigned officers are out of bidding, so their bids no longer count
    return [...data.bids.filter((b) => !edited.has(b.officerId)), ...Object.values(bidEdits).flatMap((e) => e.bids)].filter(
      (b) => exists.has(b.positionId) && !assigned[b.officerId],
    );
  }, [data.bids, data.positions, bidEdits, assigned]);
  const group = (key: "positionId" | "officerId") => {
    const m = new Map<string, Bid[]>();
    for (const b of bids) m.set(b[key], [...(m.get(b[key]) ?? []), b]);
    for (const l of m.values()) l.sort((a, b) => a.rank - b.rank);
    return m;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bidsByPosition = useMemo(() => group("positionId"), [bids]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bidsByOfficer = useMemo(() => group("officerId"), [bids]);
  const seedSubmitted = useMemo(() => new Set(data.submitted), [data.submitted]);
  const isSubmitted = useCallback(
    (id: string) => (bidEdits[id] ? bidEdits[id].submitted : seedSubmitted.has(id)),
    [bidEdits, seedSubmitted],
  );

  const myBids = useMemo(() => bidsByOfficer.get(personaId) ?? [], [bidsByOfficer, personaId]);
  const setMyBids = useCallback(
    (b: Bid[]) =>
      setBidEdits((p) => ({ ...p, [personaId]: { bids: b.map((x, i) => ({ ...x, officerId: personaId, rank: i + 1 })), submitted: false } })),
    [personaId, setBidEdits],
  );
  const submitted = isSubmitted(personaId);
  const setSubmitted = useCallback(
    (s: boolean) => setBidEdits((p) => ({ ...p, [personaId]: { bids: myBids, submitted: s } })),
    [personaId, myBids, setBidEdits],
  );

  const setOverride = (id: string, o: ListOverride | null) =>
    setEdits((e) => {
      const overrides = { ...e.overrides };
      if (o) overrides[id] = o;
      else delete overrides[id];
      return { ...e, overrides };
    });
  const addPosition = (p: Position) => setEdits((e) => ({ ...e, added: [...e.added, p] }));
  const deletePosition = (id: string) =>
    setEdits((e) =>
      e.added.some((p) => p.id === id)
        ? { ...e, added: e.added.filter((p) => p.id !== id) }
        : { ...e, deleted: [...new Set([...e.deleted, id])] },
    );
  const restorePosition = (id: string) => setEdits((e) => ({ ...e, deleted: e.deleted.filter((x) => x !== id) }));

  const visible = useMemo(
    () =>
      data.positions.filter((p) => {
        const post = lk.postById.get(p.postId)!;
        if (filters.regions.length && !filters.regions.includes(post.region)) return false;
        if (filters.grades.length && !filters.grades.includes(p.grade)) return false;
        if (filters.statuses.length && !filters.statuses.includes(status.get(p.id)!)) return false;
        return true;
      }),
    [data.positions, lk, filters.regions, filters.grades, filters.statuses, status],
  );

  const matches = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    if (!q) return null;
    const terms = q.split(/\s+/);
    const s = new Set<string>();
    for (const p of visible) {
      const post = lk.postById.get(p.postId)!;
      const o = lk.officerByPosition.get(p.id);
      const inc = lk.incoming?.get(p.id);
      const hay = [p.id, p.title, p.specialty, p.languageReq, post.city, post.country, post.subregion, post.region, o?.name, inc?.name, inc && `language training fsi ${inc.training!.language}`, ...(o?.languages ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (terms.every((t) => hay.includes(t))) s.add(p.id);
    }
    return s;
  }, [filters.q, visible, lk]);

  const value: Ctx = {
    data, source, lk, rules, setRules, status, bids, bidsByPosition, bidsByOfficer, isSubmitted,
    view: prefs.view,
    setView: (view) => setPrefs((p) => ({ ...p, view })),
    role: prefs.role,
    setRole: (role) =>
      setPrefs((p) => ({
        ...p,
        role,
        view: (role === "viewer" && p.view === "bidding") || (role !== "admin" && (p.view === "admin" || p.view === "bidlist")) ? "map" : p.view,
      })),
    filters, setFilters, visible, matches, selection, select,
    personaId, setPersonaId: (id) => setPrefs((p) => ({ ...p, personaId: id })), persona,
    myBids, setMyBids, submitted, setSubmitted,
    rounds, setRounds, roundState, roundsFor, canBid,
    biddingOn: bidding.on,
    setBiddingOn: (on) => setBidding({ on }),
    active, inActive,
    personaCanBid: canBidSet.has(personaId),
    showBidding: prefs.role === "admin" || (prefs.role === "officer" && bidding.on),
    assigned,
    assign: (id, pos, roundId) => setAssignStore((s) => ({ map: { ...s.map, [id]: { positionId: pos, roundId } } })),
    unassign: (id) =>
      setAssignStore((s) => {
        const map = { ...s.map };
        delete map[id];
        return { map };
      }),
    seedPositions: base.positions,
    edits, setOverride, addPosition, deletePosition, restorePosition,
    trainees,
    resetDemo: () => {
      setBidEdits({});
      setRoundStore({ rounds: DEFAULT_ROUNDS });
      setBidding({ on: true });
      setAssignStore({ map: {} });
      setEdits(NO_EDITS);
      setRules(DEFAULT_RULES);
    },
    postOf: (p) => lk.postById.get(p.postId)!,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
