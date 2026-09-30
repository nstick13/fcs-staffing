"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { GradeChip, StatusPill } from "./ui";
import RoundsPanel from "./RoundsPanel";
import { GRADES } from "@/lib/grades";
import { checkBidList, naturalStatus, onBidList } from "@/lib/rules";
import type { Grade } from "@/lib/types";

type Filter = "all" | "on" | "off" | "changed" | "nobids";

export default function BidListView() {
  const app = useApp();
  const { data, lk, rules, status, visible, matches, bidsByPosition, bidsByOfficer, isSubmitted, roundsFor, canBid, edits, setOverride, addPosition, deletePosition, restorePosition, seedPositions, select, setPersonaId, setView } = app;
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const posts = useMemo(() => data.posts.slice().sort((a, b) => a.city.localeCompare(b.city)), [data.posts]);
  const [form, setForm] = useState({ postId: "", grade: "02" as Grade, title: "Commercial Officer", specialty: "", ldp: false });

  const onList = useMemo(() => data.positions.filter((p) => onBidList(status.get(p.id)!)), [data.positions, status]);
  // anyone in a round, open or not; the admin sees bidding activity all the time
  const bidders = useMemo(() => data.officers.filter((o) => roundsFor(o).length > 0), [data.officers, roundsFor]);
  const addedIds = useMemo(() => new Set(edits.added.map((p) => p.id)), [edits.added]);

  const kpi = {
    onList: onList.length,
    submitted: bidders.filter((o) => isSubmitted(o.id)).length,
    noBids: onList.filter((p) => !(bidsByPosition.get(p.id)?.length ?? 0)).length,
    changes: Object.keys(edits.overrides).length + edits.added.length + edits.deleted.length,
  };

  const rows = useMemo(() => {
    const base = matches ? visible.filter((p) => matches.has(p.id)) : visible;
    return base
      .filter((p) => {
        const on = onBidList(status.get(p.id)!);
        const n = bidsByPosition.get(p.id)?.length ?? 0;
        if (filter === "on") return on;
        if (filter === "off") return !on;
        if (filter === "changed") return !!edits.overrides[p.id] || addedIds.has(p.id);
        if (filter === "nobids") return on && n === 0;
        return true;
      })
      .sort((a, b) => {
        const pa = lk.postById.get(a.postId)!, pb = lk.postById.get(b.postId)!;
        return pa.city.localeCompare(pb.city) || GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade);
      });
  }, [visible, matches, status, bidsByPosition, filter, edits.overrides, addedIds, lk]);

  const toggle = (id: string) => {
    const p = lk.positionById.get(id)!;
    const natural = onBidList(naturalStatus(p, lk, rules));
    const on = onBidList(status.get(id)!);
    // an override only exists when it differs from what tour dates would give
    setOverride(id, on ? (natural ? "remove" : null) : natural ? null : "add");
  };

  const create = () => {
    const post = lk.postById.get(form.postId);
    if (!post) return;
    let n = 1;
    while (lk.positionById.has(`${post.id}-${form.grade}-${n}`)) n++;
    const id = `${post.id}-${form.grade}-${n}`;
    addPosition({
      id,
      postId: post.id,
      grade: form.grade,
      title: form.title.trim() || "Commercial Officer",
      specialty: form.specialty.trim() || null,
      languageReq: form.ldp && post.language ? `${post.language} ${form.grade === "04" ? "2/2" : "3/3"}` : null,
    });
    flash(`Added ${id} to the bid list`);
    setAdding(false);
  };

  const deleted = seedPositions.filter((p) => edits.deleted.includes(p.id));
  const drafts = bidders.filter((o) => !isSubmitted(o.id));

  return (
    <div className="scroll">
      <div className="dash">
        <RoundsPanel />

        <div className="kpis">
          <div className="kpi"><span className="v">{kpi.onList}</span><span className="l">positions on the bid list</span></div>
          <div className="kpi"><span className="v">{kpi.submitted}<small>/{bidders.length}</small></span><span className="l">bid lists submitted</span>
            <span className="bar"><i style={{ width: `${(kpi.submitted / Math.max(1, bidders.length)) * 100}%` }} /></span></div>
          <div className="kpi warnk"><span className="v">{kpi.noBids}</span><span className="l">listed positions with no bidders</span></div>
          <div className="kpi"><span className="v">{kpi.changes}</span><span className="l">admin changes to the list</span></div>
          <div className="kpi"><span className="v">{bidders.filter((o) => canBid(o.id)).length}</span><span className="l">officers who can bid right now</span></div>
        </div>

        <div className="fieldset" style={{ padding: 0, overflow: "hidden" }}>
          <div className="chips" style={{ padding: "10px 12px", borderBottom: "1px solid var(--rule)", gap: 6 }}>
            {(
              [
                ["all", "All positions"],
                ["on", "On the list"],
                ["off", "Not on the list"],
                ["changed", "Changed by admin"],
                ["nobids", "Listed, no bidders"],
              ] as [Filter, string][]
            ).map(([k, l]) => (
              <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
            ))}
            <span className="count">{rows.length} shown · use the search and filters above to narrow</span>
            <button className="btn primary sm" onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "Add a position"}</button>
          </div>

          {adding && (
            <form className="addform" onSubmit={(e) => { e.preventDefault(); create(); }}>
              <div className="field">
                <label htmlFor="np-post">Post</label>
                <select id="np-post" required value={form.postId} onChange={(e) => setForm({ ...form, postId: e.target.value })}>
                  <option value="">Choose a post</option>
                  {posts.map((p) => <option key={p.id} value={p.id}>{p.city} ({p.country})</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="np-grade">Grade</label>
                <select id="np-grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as Grade })}>
                  {[...GRADES].reverse().map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="np-title">Title</label>
                <input id="np-title" type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="np-spec">Specialty (optional)</label>
                <input id="np-spec" type="text" placeholder="Standards, IPEF…" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
              </div>
              <label className="toggle" htmlFor="np-ldp" style={{ alignSelf: "end" }}>
                <input id="np-ldp" type="checkbox" checked={form.ldp} disabled={!lk.postById.get(form.postId)?.language} onChange={(e) => setForm({ ...form, ldp: e.target.checked })} />
                <span>Language-designated{lk.postById.get(form.postId)?.language ? ` (${lk.postById.get(form.postId)!.language})` : ""}</span>
              </label>
              <button className="btn primary" type="submit" style={{ alignSelf: "end" }}>Add to bid list</button>
            </form>
          )}

          <div className="tscroll" style={{ maxHeight: 560, overflow: "auto" }}>
            <table>
              <thead>
                <tr><th>On list</th><th>Post</th><th>Grade</th><th>Position</th><th>Incumbent</th><th>Status</th><th className="num">Bids</th><th className="num">Hardship</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const post = lk.postById.get(p.postId)!;
                  const inc = lk.officerByPosition.get(p.id);
                  const on = onBidList(status.get(p.id)!);
                  const n = bidsByPosition.get(p.id)?.length ?? 0;
                  const changed = edits.overrides[p.id];
                  return (
                    <tr key={p.id} style={{ cursor: "default" }}>
                      <td>
                        <input type="checkbox" aria-label={`${p.id} on bid list`} checked={on} onChange={() => toggle(p.id)} />
                      </td>
                      <td>{post.city}</td>
                      <td><GradeChip g={p.grade} /></td>
                      <td>
                        <button className="link" style={{ color: "var(--ink)", fontWeight: 500 }} onClick={() => select({ kind: "position", id: p.id })}>{p.title}</button>
                        {addedIds.has(p.id) && <span className="pill v-ok" style={{ marginLeft: 6 }}>New</span>}
                        {changed && <span className="pill st-encumbered" style={{ marginLeft: 6 }}>{changed === "add" ? "Added early" : "Held back"}</span>}
                      </td>
                      <td style={{ color: inc ? undefined : "var(--bad)" }}>{inc ? `${inc.name} · TED ${inc.ted}` : "Vacant"}</td>
                      <td><StatusPill s={status.get(p.id)!} /></td>
                      <td className="num">{on ? (n === 0 ? <span style={{ color: "var(--bad)" }}>0</span> : n) : ""}</td>
                      <td className="num">{post.hardship}%</td>
                      <td><button className="btn sm" onClick={() => { deletePosition(p.id); flash(`Deleted ${p.id}`); }}>Delete</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {deleted.length > 0 && (
          <div className="fieldset">
            <h2>Deleted positions</h2>
            <p>Deleting a position removes it everywhere, including any bids on it.</p>
            <div className="list">
              {deleted.map((p) => (
                <div key={p.id} className="lrow">
                  <GradeChip g={p.grade} />
                  <span className="grow">{lk.postById.get(p.postId)!.city} · {p.title} <span className="mono" style={{ color: "var(--ink-3)" }}>{p.id}</span></span>
                  <button className="btn sm" onClick={() => restorePosition(p.id)}>Restore</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="fieldset">
          <h2>Bid lists not yet submitted ({drafts.length})</h2>
          <p>Bidders still working on their lists, with the rules each one currently misses.</p>
          <div className="tscroll">
            <table>
              <thead><tr><th>Bidder</th><th>Round</th><th className="num">Bids</th><th>Missing</th><th></th></tr></thead>
              <tbody>
                {drafts.map((o) => {
                  const list = bidsByOfficer.get(o.id) ?? [];
                  const failing = checkBidList(o, list, lk, rules).filter((c) => !c.ok);
                  return (
                    <tr key={o.id} style={{ cursor: "default" }}>
                      <td><GradeChip g={o.grade} /> {o.name}</td>
                      <td>
                        {roundsFor(o).map((r) => r.name).join(", ")}
                        {canBid(o.id) && <span className="pill v-ok" style={{ marginLeft: 6 }}>open</span>}
                      </td>
                      <td className="num">{list.length}</td>
                      <td style={{ whiteSpace: "normal", fontSize: 12, color: failing.length ? "var(--bad)" : "var(--ink-3)" }}>
                        {failing.length ? failing.map((c) => c.label).join(", ") : "Ready to submit"}
                      </td>
                      <td style={{ display: "flex", gap: 4 }}>
                        <button className="btn sm" onClick={() => flash(`Reminder queued for ${o.name} (demo, nothing is sent)`)}>Remind</button>
                        <button className="btn sm" onClick={() => { setPersonaId(o.id); setView("bidding"); }}>Open list</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
