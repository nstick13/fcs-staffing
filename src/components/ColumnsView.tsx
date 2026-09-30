"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { GradeChip, StatusPill, statusLabel } from "./ui";
import { GRADES } from "@/lib/grades";
import { evaluate } from "@/lib/rules";
import type { CycleStatus, Position } from "@/lib/types";

type GroupBy = "region" | "subregion" | "grade" | "status";
const STATUS_ORDER: CycleStatus[] = ["vacant", "off-cycle", "on-cycle", "encumbered"];

export default function ColumnsView() {
  const { visible, lk, status, matches, selection, select, bidsByPosition, role, persona, rules, showBidding } = useApp();
  const [groupBy, setGroupBy] = useState<GroupBy>("region");

  const columns = useMemo(() => {
    const key = (p: Position) => {
      const post = lk.postById.get(p.postId)!;
      return groupBy === "region" ? post.region : groupBy === "subregion" ? post.subregion : groupBy === "grade" ? p.grade : status.get(p.id)!;
    };
    const m = new Map<string, Position[]>();
    for (const p of visible) {
      if (matches && !matches.has(p.id)) continue;
      m.set(key(p), [...(m.get(key(p)) ?? []), p]);
    }
    const order =
      groupBy === "grade" ? [...GRADES].reverse() : groupBy === "status" ? STATUS_ORDER : [...m.keys()];
    return order.filter((k) => m.has(k)).map((k) => {
      const list = m.get(k)!;
      // within a column, group by post, senior-heavy posts first
      const posts = new Map<string, Position[]>();
      for (const p of list) posts.set(p.postId, [...(posts.get(p.postId) ?? []), p]);
      const groups = [...posts.entries()]
        .map(([id, ps]) => ({ post: lk.postById.get(id)!, ps: ps.sort((a, b) => GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade)) }))
        .sort((a, b) => b.ps.length - a.ps.length || a.post.city.localeCompare(b.post.city));
      return { key: k, count: list.length, groups };
    });
  }, [visible, matches, groupBy, lk, status]);

  const selPos = selection?.kind === "position" ? selection.id : null;

  return (
    <div className="board">
      <div className="col" style={{ flex: "0 0 170px", padding: 12, gap: 8 }}>
        <div className="eyebrow" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-3)" }}>Columns by</div>
        <div className="seg" style={{ flexDirection: "column" }}>
          {(["region", "subregion", "grade", "status"] as GroupBy[]).map((g) => (
            <button key={g} aria-pressed={groupBy === g} onClick={() => setGroupBy(g)} style={{ borderLeft: 0 }}>
              {g === "subregion" ? "Sub-region" : g === "status" ? "Cycle status" : g[0].toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {columns.map((c) => (
        <section key={c.key} className="col">
          <div className="col-h">
            {groupBy === "grade" ? <GradeChip g={c.key as Position["grade"]} /> : null}
            <h2>{groupBy === "status" ? statusLabel(c.key as CycleStatus) : groupBy === "grade" ? "" : c.key}</h2>
            <span className="n">{c.count}</span>
          </div>
          <div className="col-b">
            {c.groups.map(({ post, ps }) => (
              <div key={post.id} style={{ display: "grid", gap: 5 }}>
                <div className="grp-h" onClick={() => select({ kind: "post", id: post.id })}>
                  <span>{post.city}{post.hardship > 0 && <span className="hd">{post.hardship}%</span>}</span>
                  <span className="mono">{post.id}</span>
                </div>
                {ps.map((p) => {
                  const inc = lk.officerByPosition.get(p.id);
                  const nb = bidsByPosition.get(p.id)?.length ?? 0;
                  const v = role === "officer" && showBidding ? evaluate(persona, p, lk, rules).verdict : null;
                  return (
                    <button key={p.id} className={`card${p.id === selPos ? " sel" : ""}`} onClick={() => select({ kind: "position", id: p.id })}>
                      <GradeChip g={p.grade} />
                      <span className="t">{p.title}</span>
                      <span className="bidn" title="Bids">{showBidding ? `${nb} bid${nb === 1 ? "" : "s"}` : ""}</span>
                      <span className="s">
                        {inc ? <span>{inc.name} · TED {inc.ted}</span> : <span className="vac-t">Vacant</span>}
                        {groupBy !== "status" && status.get(p.id) !== "encumbered" && <StatusPill s={status.get(p.id)!} />}
                        {v && v !== "blocked" && status.get(p.id) !== "encumbered" && <span className={`pill v-${v}`}>{v === "ok" ? "Can bid" : "Training"}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
      {columns.length === 0 && <div style={{ color: "var(--ink-3)", padding: 20 }}>No positions match these filters.</div>}
    </div>
  );
}
