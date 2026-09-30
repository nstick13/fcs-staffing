"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { GradeChip } from "./ui";
import { GRADES } from "@/lib/grades";
import { inRound, windowLabel } from "@/lib/rounds";
import type { Officer, Round } from "@/lib/types";

export default function RoundsPanel() {
  const { rounds, setRounds, roundState, active, biddingOn, setBiddingOn, data, rules, assigned } = useApp();
  const [expanded, setExpanded] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Round>) =>
    setRounds((rs) =>
      rs.map((r) => {
        if (r.id === id) return { ...r, ...patch };
        // only one round can be active: opening one by hand closes any other opened by hand
        if (patch.mode === "open" && r.mode === "open") return { ...r, mode: "closed" };
        return r;
      }),
    );
  const add = () => {
    const id = `r${Date.now().toString(36)}`;
    const last = rounds[rounds.length - 1];
    setRounds((rs) => [
      ...rs,
      {
        id,
        name: `Round ${rs.length + 1}`,
        roles: ["on-cycle", "off-cycle"],
        grades: [],
        include: [],
        exclude: [],
        opensAt: last?.closesAt ?? "2026-11-02T09:00",
        closesAt: last?.closesAt ?? "2026-11-13T17:00",
        mode: "closed",
      },
    ]);
    setExpanded(id);
  };

  return (
    <div className="fieldset">
      <div className="switchrow">
        <div>
          <h2>Bidding</h2>
          <p style={{ margin: 0 }}>
            {biddingOn
              ? "The bid list is posted. Every officer can browse it under Bidding."
              : "The bid list is hidden from officers. Only you can see it."}
          </p>
        </div>
        <button className={`switch${biddingOn ? " on" : ""}`} role="switch" aria-checked={biddingOn} onClick={() => setBiddingOn(!biddingOn)}>
          <span className="knob" />
          <span className="lbl">{biddingOn ? "Bidding on" : "Bidding off"}</span>
        </button>
      </div>

      <div className="activebar">
        {active ? (
          <>
            <span className="pill v-ok">Active</span> <b>{active.name}</b> · {windowLabel(active)} ·{" "}
            {data.officers.filter((o) => inRound(o, active, rules, assigned)).length} officers can bid
          </>
        ) : (
          <span>{biddingOn ? "No round is active, so no one can bid right now." : "Turn bidding on before a round can become active."}</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 14 }}>
        <h3 className="subhead">Rounds</h3>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>One round is active at a time. If two overlap, the one higher in the list goes first.</span>
        <button className="btn sm" style={{ marginLeft: "auto" }} onClick={add}>Add round</button>
      </div>
      <div className="rounds">
        {rounds.map((r) => {
          const st = roundState.get(r.id)!;
          const label =
            active?.id === r.id ? { t: "Active", c: "v-ok" }
            : st === "open" ? { t: biddingOn ? `Waiting on ${active?.name.split("·")[0].trim()}` : "Bidding off", c: "st-on-cycle" }
            : st === "scheduled" ? { t: "Scheduled", c: "st-on-cycle" }
            : { t: "Closed", c: "st-encumbered" };
          return (
            <RoundCard
              key={r.id}
              r={r}
              label={label}
              isActive={active?.id === r.id}
              open={expanded === r.id}
              onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
              update={(p) => update(r.id, p)}
              remove={() => setRounds((rs) => rs.filter((x) => x.id !== r.id))}
              members={data.officers.filter((o) => inRound(o, r, rules, assigned))}
            />
          );
        })}
        {rounds.length === 0 && <p>No rounds yet. Add one to let officers bid.</p>}
      </div>
      <AssignedList />
    </div>
  );
}

/** Officers placed this cycle. They no longer bid, and their positions are off the list. */
function AssignedList() {
  const { assigned, unassign, data, lk, rounds } = useApp();
  const ids = Object.keys(assigned);
  if (!ids.length) return null;
  const byId = new Map(data.officers.map((o) => [o.id, o]));
  return (
    <div style={{ marginTop: 16 }}>
      <h3 className="subhead">Assigned this cycle ({ids.length})</h3>
      <p style={{ fontSize: 12, margin: "4px 0 8px" }}>Assigned officers are out of bidding. Undo puts them back in any round they qualify for.</p>
      <div className="members">
        {ids.map((id) => {
          const o = byId.get(id);
          if (!o) return null;
          const a = assigned[id];
          const p = a.positionId ? lk.positionById.get(a.positionId) : null;
          return (
            <div key={id} className="member">
              <GradeChip g={o.grade} />
              <span className="grow">{o.name}</span>
              <span style={{ fontSize: 11, color: "var(--ok)", fontWeight: 600 }}>
                {p ? `${lk.postById.get(p.postId)!.city} ${p.grade}` : "Elsewhere"}
                {a.roundId ? ` · ${rounds.find((r) => r.id === a.roundId)?.name.split("·")[0].trim() ?? ""}` : ""}
              </span>
              <button className="btn sm" onClick={() => unassign(id)}>Undo</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoundCard({
  r, label, isActive, open, onToggle, update, remove, members,
}: {
  r: Round;
  label: { t: string; c: string };
  isActive: boolean;
  open: boolean;
  onToggle: () => void;
  update: (p: Partial<Round>) => void;
  remove: () => void;
  members: Officer[];
}) {
  const { data, isSubmitted, bidsByOfficer, assign, lk } = useApp();
  const [adding, setAdding] = useState("");
  const done = members.filter((o) => isSubmitted(o.id)).length;
  const others = useMemo(() => {
    const m = new Set(members.map((o) => o.id));
    return data.officers.filter((o) => !m.has(o.id) && !o.training).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, data.officers]);
  const toggleRole = (role: "on-cycle" | "off-cycle") =>
    update({ roles: r.roles.includes(role) ? r.roles.filter((x) => x !== role) : [...r.roles, role] });
  const toggleGrade = (g: (typeof GRADES)[number]) =>
    update({ grades: r.grades.includes(g) ? r.grades.filter((x) => x !== g) : [...r.grades, g] });
  const who = [
    r.roles.length === 2 ? "All bidders" : r.roles.length ? `${r.roles[0]} bidders` : "Hand-picked only",
    r.grades.length ? r.grades.slice().sort((a, b) => GRADES.indexOf(a) - GRADES.indexOf(b)).join(", ") : "all grades",
  ].filter(Boolean).join(" · ");
  const where = (id: string | null) => {
    if (!id) return "elsewhere";
    const p = lk.positionById.get(id);
    return p ? `${lk.postById.get(p.postId)!.city} ${p.grade}` : id;
  };

  return (
    <div className={`round${isActive ? " is-open" : ""}`}>
      <div className="round-h">
        <span className={`pill ${label.c}`}>{label.t}</span>
        <b className="round-name">{r.name}</b>
        <span className="round-meta">{windowLabel(r)}</span>
        <span className="round-meta">{who}</span>
        <span className="round-meta"><b>{members.length}</b> officers · {done} submitted</span>
        <div className="seg" role="group" aria-label={`${r.name} open or closed`} style={{ marginLeft: "auto" }}>
          <button aria-pressed={r.mode === "auto"} onClick={() => update({ mode: "auto" })}>Follow dates</button>
          <button aria-pressed={r.mode === "open"} onClick={() => update({ mode: "open" })}>Open</button>
          <button aria-pressed={r.mode === "closed"} onClick={() => update({ mode: "closed" })}>Closed</button>
        </div>
        <button className="btn sm" onClick={onToggle} aria-expanded={open}>{open ? "Done" : "Edit"}</button>
      </div>

      {open && (
        <div className="round-b">
          <div className="fields">
            <div className="field">
              <label htmlFor={`${r.id}-name`}>Round name</label>
              <input id={`${r.id}-name`} type="text" value={r.name} onChange={(e) => update({ name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`${r.id}-open`}>Opens</label>
              <input id={`${r.id}-open`} type="datetime-local" value={r.opensAt} onChange={(e) => update({ opensAt: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`${r.id}-close`}>Closes</label>
              <input id={`${r.id}-close`} type="datetime-local" value={r.closesAt} onChange={(e) => update({ closesAt: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "12px 0", alignItems: "center" }}>
            <div className="chips">
              <span className="lbl">Who</span>
              <button className="chip" aria-pressed={r.roles.includes("on-cycle")} onClick={() => toggleRole("on-cycle")}>On-cycle</button>
              <button className="chip" aria-pressed={r.roles.includes("off-cycle")} onClick={() => toggleRole("off-cycle")}>Off-cycle</button>
            </div>
            <div className="chips">
              <span className="lbl">Grades</span>
              {GRADES.map((g) => (
                <button key={g} className="chip g" aria-pressed={r.grades.includes(g)} onClick={() => toggleGrade(g)}>{g}</button>
              ))}
              <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{r.grades.length ? "" : "none picked = all"}</span>
            </div>
          </div>

          <div className="field" style={{ maxWidth: 420, marginBottom: 10 }}>
            <label htmlFor={`${r.id}-add`}>Add someone by hand</label>
            <div style={{ display: "flex", gap: 6 }}>
              <select id={`${r.id}-add`} value={adding} onChange={(e) => setAdding(e.target.value)}>
                <option value="">Choose an officer</option>
                {others.map((o) => <option key={o.id} value={o.id}>{o.grade} · {o.name}</option>)}
              </select>
              <button
                className="btn sm"
                disabled={!adding}
                onClick={() => {
                  update({ include: [...r.include, adding], exclude: r.exclude.filter((x) => x !== adding) });
                  setAdding("");
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div className="members">
            {members
              .slice()
              .sort((a, b) => GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade) || a.name.localeCompare(b.name))
              .map((o) => {
                const list = bidsByOfficer.get(o.id) ?? [];
                return (
                  <div key={o.id} className="member">
                    <GradeChip g={o.grade} />
                    <span className="grow">{o.name}{r.include.includes(o.id) && <span style={{ color: "var(--accent)", fontSize: 11 }}> · added</span>}</span>
                    <>
                        <span style={{ fontSize: 11, color: isSubmitted(o.id) ? "var(--ok)" : "var(--ink-3)" }}>
                          {isSubmitted(o.id) ? "submitted" : `${list.length} bids`}
                        </span>
                        <select
                          aria-label={`Assign ${o.name}`}
                          className="assign"
                          value=""
                          onChange={(e) => e.target.value && assign(o.id, e.target.value === "__else" ? null : e.target.value, r.id)}
                        >
                          <option value="">Assign…</option>
                          {list.map((b) => (
                            <option key={b.positionId} value={b.positionId}>#{b.rank} {where(b.positionId)}</option>
                          ))}
                          <option value="__else">Somewhere else</option>
                        </select>
                    </>
                    <button
                      className="btn sm"
                      aria-label={`Remove ${o.name} from ${r.name}`}
                      onClick={() => update({ exclude: [...r.exclude, o.id], include: r.include.filter((x) => x !== o.id) })}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
          </div>
          {r.exclude.length > 0 && (
            <p style={{ fontSize: 12, marginTop: 8 }}>
              {r.exclude.length} removed by hand.{" "}
              <button className="link" onClick={() => update({ exclude: [] })}>Put them back</button>
            </p>
          )}
          <div style={{ marginTop: 10 }}>
            <button className="btn sm" onClick={remove}>Delete round</button>
          </div>
        </div>
      )}
    </div>
  );
}
