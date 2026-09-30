"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { GradeChip, statusLabel } from "./ui";
import { GRADES, gradeGap } from "@/lib/grades";
import { onBidList } from "@/lib/rules";
import type { CycleStatus, Grade, Position } from "@/lib/types";

type Sort = "bids" | "first" | "fewest" | "post";
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8];
const STATUS_ORDER: CycleStatus[] = ["vacant", "off-cycle", "on-cycle"];

export default function BidMatrixView() {
  const { data, lk, status, visible, matches, bidsByPosition, select, selection, isSubmitted } = useApp();
  const [sort, setSort] = useState<Sort>("bids");
  const [onlySubmitted, setOnlySubmitted] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const officerById = useMemo(() => new Map(data.officers.map((o) => [o.id, o])), [data.officers]);

  const listed = useMemo(
    () => visible.filter((p) => onBidList(status.get(p.id)!) && (!matches || matches.has(p.id))),
    [visible, status, matches],
  );

  const rows = useMemo(() => {
    const r = listed.map((p) => {
      const bids = (bidsByPosition.get(p.id) ?? []).filter((b) => !onlySubmitted || isSubmitted(b.officerId));
      const byRank = RANKS.map((k) => bids.filter((b) => (k === 8 ? b.rank >= 8 : b.rank === k)).length);
      const atGrade = bids.filter((b) => gradeGap(officerById.get(b.officerId)!.grade, p.grade) === 0).length;
      return { p, total: bids.length, byRank, first: byRank[0], atGrade };
    });
    const city = (p: Position) => lk.postById.get(p.postId)!.city;
    return r.sort((a, b) =>
      sort === "bids" ? b.total - a.total || b.first - a.first
      : sort === "first" ? b.first - a.first || b.total - a.total
      : sort === "fewest" ? a.total - b.total || city(a.p).localeCompare(city(b.p))
      : city(a.p).localeCompare(city(b.p)) || GRADES.indexOf(b.p.grade) - GRADES.indexOf(a.p.grade),
    );
  }, [listed, bidsByPosition, onlySubmitted, isSubmitted, officerById, sort, lk]);

  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const totalBids = rows.reduce((s, r) => s + r.total, 0);
  const bidderIds = new Set(rows.flatMap((r) => (bidsByPosition.get(r.p.id) ?? []).map((b) => b.officerId)));
  const zero = rows.filter((r) => r.total === 0).length;
  const sortedTotals = rows.map((r) => r.total).sort((a, b) => a - b);
  const median = sortedTotals.length ? sortedTotals[Math.floor(sortedTotals.length / 2)] : 0;

  // bidder grade x position grade
  const grid = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows)
      for (const b of bidsByPosition.get(r.p.id) ?? []) {
        if (onlySubmitted && !isSubmitted(b.officerId)) continue;
        const k = `${officerById.get(b.officerId)!.grade}|${r.p.grade}`;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    return m;
  }, [rows, bidsByPosition, officerById, onlySubmitted, isSubmitted]);
  const gridMax = Math.max(1, ...grid.values());
  const usedGrades = GRADES.filter((g) => rows.some((r) => r.p.grade === g) || data.officers.some((o) => o.grade === g));

  const byStatus = STATUS_ORDER.map((s) => {
    const rs = rows.filter((r) => status.get(r.p.id) === s);
    return { s, positions: rs.length, bids: rs.reduce((n, r) => n + r.total, 0) };
  });
  const statusMax = Math.max(1, ...byStatus.map((x) => x.bids));

  const show = (e: React.MouseEvent, text: string) => setTip({ x: e.clientX + 12, y: e.clientY + 12, text });
  const selPos = selection?.kind === "position" ? selection.id : null;

  return (
    <div className="scroll" onMouseLeave={() => setTip(null)}>
      <div className="dash">
        <div className="matrix-head">
          <div>
            <h2 className="pagetitle">Bid matrix</h2>
            <p className="lede">
              <span className="live" aria-hidden="true" /> Live. Updates the moment a bid is added, moved or removed. Click a position to see who bid on it.
            </p>
          </div>
          <label className="toggle" htmlFor="mx-sub">
            <input id="mx-sub" type="checkbox" checked={onlySubmitted} onChange={(e) => setOnlySubmitted(e.target.checked)} />
            <span>Submitted lists only</span>
          </label>
        </div>

        <div className="kpis">
          <div className="kpi"><span className="v">{rows.length}</span><span className="l">positions on the list</span></div>
          <div className="kpi"><span className="v">{totalBids}</span><span className="l">bids from {bidderIds.size} officers</span></div>
          <div className="kpi"><span className="v">{median}</span><span className="l">median bids per position</span></div>
          <div className="kpi warnk"><span className="v">{zero}</span><span className="l">positions with no bids</span></div>
          <div className="kpi"><span className="v">{rows.filter((r) => r.first > 1).length}</span><span className="l">positions that are 2+ officers&apos; first choice</span></div>
        </div>

        <div className="mx-grid">
          <section className="fieldset mx-main">
            <div className="mx-toolbar">
              <h2>Demand by position</h2>
              <div className="seg" role="group" aria-label="Sort">
                {(
                  [
                    ["bids", "Most bids"],
                    ["first", "Most first choices"],
                    ["fewest", "Fewest bids"],
                    ["post", "Post A–Z"],
                  ] as [Sort, string][]
                ).map(([k, l]) => (
                  <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="rank-legend" aria-label="Bar segments show the rank each bidder gave the position">
              <span>Rank bidders gave it:</span>
              {RANKS.map((k) => (
                <span key={k} className="sw"><i className={`r${k}`} />{k}</span>
              ))}
            </div>
            <div className="mx-rows" role="table" aria-label="Bids by position">
              {rows.map((r) => {
                const post = lk.postById.get(r.p.postId)!;
                return (
                  <button
                    key={r.p.id}
                    role="row"
                    className={`mx-row${r.p.id === selPos ? " sel" : ""}`}
                    onClick={() => select({ kind: "position", id: r.p.id })}
                  >
                    <span className="mx-id" role="cell">
                      <GradeChip g={r.p.grade} />
                      <span className="mx-name">
                        <b>{post.city}</b> {r.p.title}
                        <span className="mono">{r.p.id}</span>
                      </span>
                    </span>
                    <span className="mx-bar" role="cell">
                      <span className="track" style={{ width: `${(r.total / maxTotal) * 100}%` }}>
                        {r.byRank.map((n, i) =>
                          n ? (
                            <i
                              key={i}
                              className={`r${i + 1}`}
                              style={{ flexGrow: n }}
                              onMouseMove={(e) => show(e, `${n} officer${n === 1 ? "" : "s"} ranked ${post.city} ${r.p.grade} #${i + 1}`)}
                              onMouseLeave={() => setTip(null)}
                            />
                          ) : null,
                        )}
                      </span>
                      {r.total === 0 && <span className="none">No bids</span>}
                    </span>
                    <span className="mx-num mono" role="cell">
                      <b>{r.total}</b>
                      <small>{r.total ? `${r.atGrade} at grade` : ""}</small>
                    </span>
                  </button>
                );
              })}
              {rows.length === 0 && <p style={{ padding: 12 }}>No listed positions match the filters.</p>}
            </div>
          </section>

          <div className="mx-side">
            <section className="fieldset">
              <h2>Who is bidding on what grade</h2>
              <p>Bids by the bidder&apos;s grade (rows) and the position&apos;s grade (columns). The outlined diagonal is at grade; right of it are stretches.</p>
              <div className="tscroll">
                <table className="heatgrid">
                  <thead>
                    <tr>
                      <th scope="col"><span className="sr-only">Bidder grade</span></th>
                      {usedGrades.map((g) => <th key={g} scope="col"><GradeChip g={g} /></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[...usedGrades].reverse().map((bg) => (
                      <tr key={bg}>
                        <th scope="row"><GradeChip g={bg} /></th>
                        {usedGrades.map((pg) => {
                          const n = grid.get(`${bg}|${pg}`) ?? 0;
                          const gap = gradeGap(bg as Grade, pg as Grade);
                          const t = n / gridMax;
                          return (
                            <td
                              key={pg}
                              className={gap === 0 ? "diag" : ""}
                              style={{ background: n ? `color-mix(in srgb, var(--accent) ${Math.round(12 + t * 78)}%, var(--panel))` : undefined, color: t > 0.5 ? "#fff" : undefined }}
                              onMouseMove={(e) => show(e, `${n} bid${n === 1 ? "" : "s"} by ${bg} officers on ${pg} positions (${gap === 0 ? "at grade" : gap > 0 ? `stretch +${gap}` : `stoop ${gap}`})`)}
                              onMouseLeave={() => setTip(null)}
                            >
                              {n || ""}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="fieldset">
              <h2>By cycle status</h2>
              <div className="statusbars">
                {byStatus.map((x) => (
                  <div key={x.s} className="sb">
                    <span className="sb-l">{statusLabel(x.s)}</span>
                    <span className="sb-bar">
                      <i style={{ width: `${(x.bids / statusMax) * 100}%` }} />
                    </span>
                    <span className="sb-n mono">{x.bids} bids · {x.positions} positions</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
      {tip && <div className="maptip" style={{ position: "fixed", left: tip.x, top: tip.y }}>{tip.text}</div>}
    </div>
  );
}
