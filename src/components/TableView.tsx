"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { GradeChip, StatusPill, statusLabel } from "./ui";
import { GRADES, gradeRank } from "@/lib/grades";
import type { CycleStatus, Position } from "@/lib/types";

type Dim = "region" | "subregion" | "country" | "post" | "grade" | "status";
type Metric = "positions" | "vacant" | "bids";
const DIM_LABEL: Record<Dim, string> = { region: "Region", subregion: "Sub-region", country: "Country", post: "Post", grade: "Grade", status: "Cycle status" };
const STATUS_ORDER: CycleStatus[] = ["vacant", "off-cycle", "on-cycle", "encumbered"];

type SortKey = "post" | "grade" | "title" | "incumbent" | "ted" | "status" | "bids" | "hardship";

export default function TableView() {
  const { visible, matches, lk, status, bidsByPosition, selection, select, showBidding } = useApp();
  const [rowDim, setRowDim] = useState<Dim>("subregion");
  const [colDim, setColDim] = useState<Dim>("grade");
  const [metric, setMetric] = useState<Metric>("positions");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "post", dir: 1 });

  const rows = useMemo(() => (matches ? visible.filter((p) => matches.has(p.id)) : visible), [visible, matches]);

  const dimVal = (p: Position, d: Dim) => {
    const post = lk.postById.get(p.postId)!;
    switch (d) {
      case "region": return post.region;
      case "subregion": return post.subregion;
      case "country": return post.country;
      case "post": return post.city;
      case "grade": return p.grade;
      case "status": return status.get(p.id)!;
    }
  };
  const orderDim = (d: Dim, keys: string[]) =>
    d === "grade" ? GRADES.filter((g) => keys.includes(g)).reverse() : d === "status" ? STATUS_ORDER.filter((s) => keys.includes(s)) : keys.sort();

  const pivot = useMemo(() => {
    const cell = new Map<string, number>();
    const rset = new Set<string>();
    const cset = new Set<string>();
    for (const p of rows) {
      const r = dimVal(p, rowDim);
      const c = dimVal(p, colDim);
      rset.add(r);
      cset.add(c);
      const v = metric === "positions" ? 1 : metric === "vacant" ? (lk.officerByPosition.has(p.id) ? 0 : 1) : bidsByPosition.get(p.id)?.length ?? 0;
      cell.set(`${r}|${c}`, (cell.get(`${r}|${c}`) ?? 0) + v);
    }
    const rk = orderDim(rowDim, [...rset]);
    const ck = orderDim(colDim, [...cset]);
    const max = Math.max(1, ...cell.values());
    return { rk, ck, cell, max };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, rowDim, colDim, metric, lk, status, bidsByPosition]);

  const sorted = useMemo(() => {
    const val = (p: Position): string | number => {
      const post = lk.postById.get(p.postId)!;
      const inc = lk.officerByPosition.get(p.id);
      switch (sort.k) {
        case "post": return post.city;
        case "grade": return gradeRank(p.grade);
        case "title": return p.title;
        case "incumbent": return inc?.name ?? "~";
        case "ted": return inc?.ted ?? "0000";
        case "status": return STATUS_ORDER.indexOf(status.get(p.id)!);
        case "bids": return bidsByPosition.get(p.id)?.length ?? 0;
        case "hardship": return post.hardship;
      }
    };
    return rows.slice().sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, sort, lk, status, bidsByPosition]);

  const th = (k: SortKey, label: string, num = false) => (
    <th className={num ? "num" : ""} aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : 1 }))}>
        {label}{sort.k === k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
  const dimSelect = (v: Dim, set: (d: Dim) => void, id: string) => (
    <select id={id} value={v} onChange={(e) => set(e.target.value as Dim)}>
      {(Object.keys(DIM_LABEL) as Dim[]).map((d) => <option key={d} value={d}>{DIM_LABEL[d]}</option>)}
    </select>
  );
  const colLabel = (c: string) => (colDim === "status" ? statusLabel(c as CycleStatus) : c);
  const selPos = selection?.kind === "position" ? selection.id : null;

  return (
    <div className="scroll">
      <div className="pivot-wrap">
        <div className="pivot-ctl">
          <strong style={{ color: "var(--ink)" }}>Pivot</strong>
          <label htmlFor="pv-m">Count</label>
          <select id="pv-m" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            <option value="positions">Positions</option>
            <option value="vacant">Vacancies</option>
            {showBidding && <option value="bids">Bids</option>}
          </select>
          <label htmlFor="pv-r">rows</label>
          {dimSelect(rowDim, setRowDim, "pv-r")}
          <label htmlFor="pv-c">columns</label>
          {dimSelect(colDim, setColDim, "pv-c")}
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>{DIM_LABEL[rowDim]}</th>
                {pivot.ck.map((c) => <th key={c} className="num">{colDim === "grade" ? <GradeChip g={c as Position["grade"]} /> : colLabel(c)}</th>)}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {pivot.rk.map((r) => {
                let tot = 0;
                return (
                  <tr key={r} style={{ cursor: "default" }}>
                    <td>{rowDim === "status" ? statusLabel(r as CycleStatus) : r}</td>
                    {pivot.ck.map((c) => {
                      const v = pivot.cell.get(`${r}|${c}`) ?? 0;
                      tot += v;
                      const a = v / pivot.max;
                      return (
                        <td key={c} className="num">
                          {v > 0 && <span className="heat" style={{ background: `color-mix(in srgb, var(--accent) ${Math.round(a * 55)}%, transparent)` }}>{v}</span>}
                        </td>
                      );
                    })}
                    <td className="num"><b>{tot}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="data-wrap tscroll">
        <table>
          <thead>
            <tr>
              {th("post", "Post")}
              {th("grade", "Grade")}
              {th("title", "Position")}
              {th("incumbent", "Incumbent")}
              {th("ted", "TED")}
              {th("status", "Cycle")}
              {th("hardship", "Hardship", true)}
              {showBidding && th("bids", "Bids", true)}
              <th>Language</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const post = lk.postById.get(p.postId)!;
              const inc = lk.officerByPosition.get(p.id);
              return (
                <tr key={p.id} className={p.id === selPos ? "sel" : ""} onClick={() => select({ kind: "position", id: p.id })}>
                  <td>{post.city} <span className="mono" style={{ color: "var(--ink-3)", fontSize: 11 }}>{post.id}</span></td>
                  <td><GradeChip g={p.grade} /></td>
                  <td>{p.title}</td>
                  <td style={{ color: inc ? undefined : "var(--bad)" }}>{inc ? `${inc.name} (${inc.grade})` : "Vacant"}</td>
                  <td className="mono">{inc?.ted ?? ""}</td>
                  <td><StatusPill s={status.get(p.id)!} /></td>
                  <td className="num">{post.hardship}%</td>
                  {showBidding && <td className="num">{bidsByPosition.get(p.id)?.length ?? 0}</td>}
                  <td>{p.languageReq ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
