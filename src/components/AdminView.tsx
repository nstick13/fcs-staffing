"use client";

import { useMemo } from "react";
import { useApp } from "./AppProvider";
import { GradeChip, StatusPill } from "./ui";
import { DEFAULT_RULES, bidderRole } from "@/lib/rules";
import type { RuleConfig } from "@/lib/types";

type NumKey = { [K in keyof RuleConfig]: RuleConfig[K] extends number ? K : never }[keyof RuleConfig];
type BoolKey = { [K in keyof RuleConfig]: RuleConfig[K] extends boolean ? K : never }[keyof RuleConfig];

export default function AdminView() {
  const { rules, setRules, data, lk, status, bidsByPosition, select, source, resetDemo } = useApp();
  const set = <K extends keyof RuleConfig>(k: K, v: RuleConfig[K]) => setRules({ ...rules, [k]: v });

  const num = (k: NumKey, label: string, hint: string) => (
    <div className="field">
      <label htmlFor={`r-${k}`}>{label}</label>
      <input id={`r-${k}`} type="number" min={0} max={20} value={rules[k]} onChange={(e) => set(k, Number(e.target.value))} />
      <span className="hint">{hint}</span>
    </div>
  );
  const bool = (k: BoolKey, label: string) => (
    <label className="toggle" htmlFor={`r-${k}`}>
      <input id={`r-${k}`} type="checkbox" checked={rules[k]} onChange={(e) => set(k, e.target.checked)} />
      <span>{label}</span>
    </label>
  );

  const counts = useMemo(() => {
    const c = { "on-cycle": 0, "off-cycle": 0, "not-bidding": 0 };
    data.officers.forEach((o) => c[bidderRole(o, rules)]++);
    const s = { vacant: 0, "off-cycle": 0, "on-cycle": 0, encumbered: 0 };
    status.forEach((v) => s[v]++);
    return { c, s };
  }, [data.officers, rules, status]);

  const demand = useMemo(
    () =>
      data.positions
        .filter((p) => status.get(p.id) !== "encumbered")
        .map((p) => ({ p, n: bidsByPosition.get(p.id)?.length ?? 0 }))
        .sort((a, b) => b.n - a.n),
    [data.positions, status, bidsByPosition],
  );
  const zero = demand.filter((d) => d.n === 0);

  return (
    <div className="scroll">
      <div className="admin">
        <div className="banner">
          Rules apply instantly across the map, columns and every bidder&apos;s eligibility. Saved in this browser for now
          {source === "supabase" ? "; the active cycle row in Supabase holds the shared copy." : "; they move to the database once Supabase is connected."}
        </div>

        <div className="fieldset">
          <h2>Cycle</h2>
          <p>Incumbents whose tour ends inside the window are on-cycle. Earlier TEDs and vacancies are off-cycle. Later TEDs stay off the list.</p>
          <div className="fields">
            <div className="field">
              <label htmlFor="r-label">Cycle name</label>
              <input id="r-label" type="text" value={rules.cycleLabel} onChange={(e) => set("cycleLabel", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="r-start">On-cycle TEDs from</label>
              <input id="r-start" type="month" value={rules.onCycleStart} onChange={(e) => set("onCycleStart", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="r-end">through</label>
              <input id="r-end" type="month" value={rules.onCycleEnd} onChange={(e) => set("onCycleEnd", e.target.value)} />
            </div>
          </div>
          <p style={{ marginTop: 12, marginBottom: 0 }}>
            Right now: <b>{counts.c["on-cycle"]}</b> on-cycle bidders, <b>{counts.c["off-cycle"]}</b> off-cycle bidders.{" "}
            <b>{counts.s["on-cycle"]}</b> on-cycle positions, <b>{counts.s["off-cycle"]}</b> off-cycle, <b>{counts.s.vacant}</b> vacant.
          </p>
        </div>

        <div className="fieldset">
          <h2>List composition</h2>
          <p>Region and hardship minimums apply to on-cycle lists; off-cycle bidders have too few positions to choose from.</p>
          <div className="fields">
            {num("maxBidsOnCycle", "Max bids, on-cycle", "Most positions an on-cycle bidder may list")}
            {num("maxBidsOffCycle", "Max bids, off-cycle", "Most positions an off-cycle bidder may list")}
            {num("minAtGradeOnCycle", "Min at-grade, on-cycle", "0 turns the requirement off")}
            {num("minAtGradeOffCycle", "Min at-grade, off-cycle", "0 turns the requirement off")}
            {num("minRegions", "Min regions", "Distinct regions on one list")}
            {num("minHardshipBids", "Min hardship bids", "Bids at or above the threshold below")}
            {num("hardshipThreshold", "Hardship threshold (%)", "Differential that counts as a hardship bid")}
          </div>
        </div>

        <div className="fieldset">
          <h2>Stretch and stoop</h2>
          <p>A stretch is a bid on a position above your grade; a stoop is below it. 01 to OC crosses into the Senior Foreign Service.</p>
          <div className="fields">
            {num("maxStretch", "Max stretch (grades)", "2 lets an 04 bid on 02 positions")}
            {num("maxStoop", "Max stoop (grades)", "1 lets an 02 bid on 03 positions")}
            {num("maxStretchBids", "Max stretch bids", "How many stretches one list may hold")}
            {num("maxDoubleStretchBids", "Max double stretches", "Bids two grades up, like an 04 on an 02")}
          </div>
          <div style={{ marginTop: 12 }}>{bool("allowSfsStretch", "Allow FS-01 officers to stretch into SFS (OC and above) positions")}</div>
        </div>

        <div className="fieldset">
          <h2>Cycle eligibility</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {bool("offCycleOnlyOffCycle", "Off-cycle bidders can bid only on vacant and off-cycle positions")}
            {bool("onCycleMayBidOffCycle", "On-cycle bidders may bid on positions that open before their TED")}
            {bool("noSamePost", "No consecutive tours at the same post")}
            {bool("matrixForOfficers", "Officers can see the bid matrix (bid counts by position, no names) while bidding is on")}
            <div className="field" style={{ maxWidth: 360 }}>
              <label htmlFor="r-lang">Language-designated positions without the language</label>
              <select id="r-lang" value={rules.languageMode} onChange={(e) => set("languageMode", e.target.value as RuleConfig["languageMode"])}>
                <option value="allow">Allow silently</option>
                <option value="warn">Allow, flag as needing training</option>
                <option value="block">Block the bid</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => setRules(DEFAULT_RULES)}>Reset rules to defaults</button>{" "}
            <button className="btn" onClick={resetDemo}>Reset the whole demo</button>
          </div>
        </div>

        <div className="fieldset">
          <h2>Demand</h2>
          <p>Positions on the list by number of bidders. {zero.length} have no bids yet.</p>
          <div className="tscroll">
            <table>
              <thead>
                <tr><th>Post</th><th>Grade</th><th>Position</th><th>Cycle</th><th className="num">Bidders</th></tr>
              </thead>
              <tbody>
                {demand.slice(0, 15).concat(zero.slice(0, 5)).map(({ p, n }) => (
                  <tr key={p.id} onClick={() => select({ kind: "position", id: p.id })}>
                    <td>{lk.postById.get(p.postId)!.city}</td>
                    <td><GradeChip g={p.grade} /></td>
                    <td>{p.title}</td>
                    <td><StatusPill s={status.get(p.id)!} /></td>
                    <td className="num">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
