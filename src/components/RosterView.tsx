"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { GradeChip } from "./ui";
import { gradeGap, gradeRank } from "@/lib/grades";
import { bidderRole } from "@/lib/rules";
import type { Officer } from "@/lib/types";

type SortKey = "name" | "grade" | "post" | "position" | "ted" | "status";
type Show = "all" | "serving" | "training" | "between";

export default function RosterView() {
  const { data, lk, rules, filters, select, selection, role, roundsFor, active, assigned } = useApp();
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "post", dir: 1 });
  const [show, setShow] = useState<Show>("all");
  const admin = role === "admin";

  const rows = useMemo(() => {
    const q = filters.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.officers
      .map((o) => {
        const posId = o.positionId ?? o.training?.onwardPositionId ?? null;
        const pos = posId ? lk.positionById.get(posId) : undefined;
        const post = pos ? lk.postById.get(pos.postId) : undefined;
        const state: Show = o.training ? "training" : o.positionId ? "serving" : "between";
        return { o, pos, post, state };
      })
      .filter(({ o, pos, post, state }) => {
        if (show !== "all" && state !== show) return false;
        // the region and grade chips apply to people too
        if (filters.grades.length && !filters.grades.includes(o.grade)) return false;
        if (filters.regions.length && (!post || !filters.regions.includes(post.region))) return false;
        if (!q.length) return true;
        const hay = [o.name, o.grade, pos?.title, pos?.id, post?.city, post?.country, post?.region, ...o.languages, o.training ? `language training fsi ${o.training.language}` : ""]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return q.every((t) => hay.includes(t));
      })
      .sort((a, b) => {
        const v = (r: typeof a): string | number => {
          switch (sort.k) {
            case "name": return r.o.name.split(" ").slice(-1)[0];
            case "grade": return gradeRank(r.o.grade);
            case "post": return r.state === "training" ? "~FSI" : r.post?.city ?? "~~";
            case "position": return r.pos?.title ?? "~";
            case "ted": return r.o.ted ?? r.o.training?.until ?? "9999";
            case "status": return r.state;
          }
        };
        const x = v(a), y = v(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || gradeRank(b.o.grade) - gradeRank(a.o.grade);
      });
  }, [data.officers, lk, filters, show, sort]);

  const counts = useMemo(() => {
    const c = { serving: 0, training: 0, between: 0 };
    data.officers.forEach((o) => c[o.training ? "training" : o.positionId ? "serving" : "between"]++);
    return c;
  }, [data.officers]);

  const th = (k: SortKey, label: string) => (
    <th aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : 1 }))}>
        {label}{sort.k === k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  const roundCell = (o: Officer) => {
    if (o.id in assigned) {
      const pid = assigned[o.id].positionId;
      const p = pid ? lk.positionById.get(pid) : null;
      return <span className="pill v-ok">Assigned{p ? ` · ${lk.postById.get(p.postId)!.city}` : ""}</span>;
    }
    const rs = roundsFor(o);
    if (!rs.length) return <span style={{ color: "var(--ink-3)" }}>{bidderRole(o, rules) === "not-bidding" ? "" : "No round"}</span>;
    return rs.map((r) => (
      <span key={r.id} className={`pill ${active?.id === r.id ? "v-ok" : "st-encumbered"}`} style={{ marginRight: 4 }}>
        {r.name.split("·")[0].trim()}
      </span>
    ));
  };

  return (
    <div className="scroll">
      <div className="dash">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="seg" role="group" aria-label="Show">
            {(
              [
                ["all", `Everyone (${data.officers.length})`],
                ["serving", `Serving (${counts.serving})`],
                ["training", `Language training (${counts.training})`],
                ["between", `Between assignments (${counts.between})`],
              ] as [Show, string][]
            ).map(([k, l]) => (
              <button key={k} aria-pressed={show === k} onClick={() => setShow(k)}>{l}</button>
            ))}
          </div>
          <span className="count">{rows.length} shown</span>
        </div>

        <div className="data-wrap tscroll">
          <table>
            <thead>
              <tr>
                {th("name", "Officer")}
                {th("grade", "Grade")}
                {th("post", "Post")}
                {th("position", "Position")}
                {th("ted", "TED")}
                {th("status", "Status")}
                <th>Languages</th>
                {admin && <th>Bidding</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ o, pos, post, state }) => {
                const gap = pos && state === "serving" ? gradeGap(o.grade, pos.grade) : 0;
                const sel = selection?.kind === "position" && pos && selection.id === pos.id;
                return (
                  <tr key={o.id} className={sel ? "sel" : ""} onClick={() => pos && select({ kind: "position", id: pos.id })} style={{ cursor: pos ? "pointer" : "default" }}>
                    <td><b style={{ fontWeight: 600 }}>{o.name}</b></td>
                    <td><GradeChip g={o.grade} /></td>
                    <td>
                      {state === "training" ? <span style={{ color: "var(--accent)" }}>FSI, then {post?.city}</span> : post ? post.city : <span style={{ color: "var(--ink-3)" }}>Unassigned</span>}
                      {post && state === "serving" && <span style={{ color: "var(--ink-3)", fontSize: 11 }}> · {post.country}</span>}
                    </td>
                    <td>
                      {pos ? <><GradeChip g={pos.grade} /> {pos.title}</> : ""}
                      {gap !== 0 && <span style={{ fontSize: 11, marginLeft: 6, color: gap > 0 ? "var(--bad)" : "var(--ok)" }}>{gap > 0 ? "stretch" : "stoop"}</span>}
                    </td>
                    <td className="mono">{o.ted ?? (o.training ? `until ${o.training.until}` : "")}</td>
                    <td>
                      {state === "training" ? <span className="pill" style={{ color: "var(--accent)" }}>{o.training!.language.replace(/\s.*/, "")} training</span>
                        : state === "between" ? <span className="pill st-encumbered">Between</span>
                        : <span className="pill st-encumbered" style={{ color: "var(--ink-2)" }}>Serving</span>}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--ink-2)" }}>{o.languages.join(", ")}</td>
                    {admin && <td>{roundCell(o)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <div style={{ color: "var(--ink-3)" }}>No one matches. Clear the search or filters.</div>}
      </div>
    </div>
  );
}
