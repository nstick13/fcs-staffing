"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { GradeChip, StatusPill, VerdictPill, gapLabel } from "./ui";
import { GRADES, GRADE_NAMES, gradeGap } from "@/lib/grades";
import { lowerFirst, windowLabel } from "@/lib/rounds";
import { bidderRole, checkBidList, evaluate, onBidList } from "@/lib/rules";
import type { Bid } from "@/lib/types";

export default function BiddingView() {
  const { data, lk, rules, status, visible, matches, persona, personaId, setPersonaId, myBids, setMyBids, submitted, setSubmitted, select, bidsByPosition, role: appRole, canBid, personaCanBid, roundsFor, roundState, active, assigned } = useApp();
  const admin = appRole === "admin";
  // everyone can browse the posted list; only members of the active round can build one
  const biddingOpen = personaCanBid;
  const locked = submitted || !biddingOpen;
  const [pick, setShow] = useState<"eligible" | "all">("eligible");
  const show = biddingOpen ? pick : "all";
  const [drag, setDrag] = useState<number | null>(null);
  const role = bidderRole(persona, rules);
  const current = persona.positionId ? lk.positionById.get(persona.positionId) : null;
  const currentPost = current ? lk.postById.get(current.postId) : null;

  const bidders = useMemo(
    () =>
      data.officers
        .filter((o) => !o.training)
        .sort((a, b) => GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade) || a.name.localeCompare(b.name)),
    [data.officers],
  );

  const mySet = new Set(myBids.map((b) => b.positionId));
  const rows = useMemo(
    () =>
      visible
        .filter((p) => onBidList(status.get(p.id)!) && (!matches || matches.has(p.id)))
        .map((p) => ({ p, e: evaluate(persona, p, lk, rules) }))
        .filter((x) => show === "all" || x.e.verdict !== "blocked")
        .sort((a, b) => {
          const city = lk.postById.get(a.p.postId)!.city.localeCompare(lk.postById.get(b.p.postId)!.city);
          if (!biddingOpen) return city || GRADES.indexOf(b.p.grade) - GRADES.indexOf(a.p.grade);
          const v = { ok: 0, warn: 1, blocked: 2 };
          return v[a.e.verdict] - v[b.e.verdict] || Math.abs(a.e.gap) - Math.abs(b.e.gap) || city;
        }),
    [visible, status, matches, persona, lk, rules, show, biddingOpen],
  );

  const checks = checkBidList(persona, myBids, lk, rules);

  // Group the list by how each position sits against the bidder's own grade, with
  // the limit for each group. A group whose limit is used up collapses.
  const myGaps = myBids.map((b) => {
    const pos = lk.positionById.get(b.positionId);
    return pos ? { id: pos.id, gap: gradeGap(persona.grade, pos.grade), city: lk.postById.get(pos.postId)!.city } : null;
  }).filter((x): x is { id: string; gap: number; city: string } => !!x);
  const maxBids = bidderRole(persona, rules) === "on-cycle" ? rules.maxBidsOnCycle : rules.maxBidsOffCycle;
  const full = myBids.length >= maxBids;
  const minAtGrade = bidderRole(persona, rules) === "on-cycle" ? rules.minAtGradeOnCycle : rules.minAtGradeOffCycle;
  const gradeAt = (gap: number) => GRADES[GRADES.indexOf(persona.grade) + gap];
  const GROUPS = biddingOpen
    ? [
        { key: "g0", gap: 0, label: "At grade" },
        { key: "g1", gap: 1, label: "Stretch" },
        { key: "g2", gap: 2, label: "Double stretch" },
        { key: "g-1", gap: -1, label: "Stoop" },
        { key: "gx", gap: null, label: "Not eligible" },
      ]
    : [{ key: "all", gap: undefined, label: "Bid list" }];
  const groups = GROUPS.map((G) => {
    const inGroup = rows.filter(({ e }) =>
      G.gap === undefined ? true : G.gap === null ? e.verdict === "blocked" : e.verdict !== "blocked" && e.gap === G.gap,
    );
    const used = G.gap === null || G.gap === undefined ? [] : myGaps.filter((m) => m.gap === G.gap);
    let rule: { ok: boolean; text: string } | null = null;
    let capped = false;
    if (G.gap === 0 && minAtGrade > 0) rule = { ok: used.length >= minAtGrade, text: `${used.length} of ${minAtGrade} required` };
    if (G.gap === 1 && rules.maxStretchBids < maxBids) {
      capped = used.length >= rules.maxStretchBids;
      rule = { ok: true, text: `${used.length} of ${rules.maxStretchBids} allowed` };
    }
    if (G.gap === 2) {
      capped = used.length >= rules.maxDoubleStretchBids;
      rule = { ok: true, text: capped ? `${used.length} of ${rules.maxDoubleStretchBids} used` : `${rules.maxDoubleStretchBids} allowed` };
    }
    return {
      ...G,
      grade: typeof G.gap === "number" ? gradeAt(G.gap) : undefined,
      rows: inGroup,
      rule,
      capped,
      onList: used.map((u) => `${u.city} ${gradeAt(G.gap as number)}`),
    };
  }).filter((g) => g.rows.length > 0 || (g.gap === 0 && biddingOpen));
  const allOk = checks.every((c) => c.ok);
  const max = role === "on-cycle" ? rules.maxBidsOnCycle : rules.maxBidsOffCycle;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= myBids.length || from === to) return;
    const next = myBids.slice();
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setMyBids(next);
  };
  function roundStatusCard() {
    const mine = assigned[persona.id]?.positionId;
    const next = roundsFor(persona).find((r) => roundState.get(r.id) === "scheduled");
    let msg: string;
    if (persona.id in assigned) {
      const p = mine ? lk.positionById.get(mine) : null;
      msg = p ? `Assigned to ${lk.postById.get(p.postId)!.city} (${p.grade} ${p.title}) this cycle.` : "Assigned this cycle.";
    } else if (active) msg = `${active.name} is active (${lowerFirst(windowLabel(active))}). ${admin ? "This officer isn't" : "You're not"} in this round.`;
    else msg = "No bidding round is active right now.";
    if (!(persona.id in assigned) && next) msg += ` ${admin ? "They're" : "You're"} in ${next.name}, which ${lowerFirst(windowLabel(next))}.`;
    return <div className="banner" style={{ marginBottom: 14 }}>{msg} The bid list is open for browsing.</div>;
  }
  const add = (id: string) => setMyBids([...myBids, { officerId: persona.id, positionId: id, rank: myBids.length + 1 } as Bid]);

  return (
    <div className="bidgrid">
      <section>
        <div className="persona">
          <div className="persona-top">
            {admin ? (
              <>
                <label htmlFor="persona" style={{ fontSize: 12, color: "var(--ink-3)" }}>Bid list for</label>
                <select id="persona" value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
                  {bidders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.grade} · {o.name}{canBid(o.id) ? " · can bid" : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <b style={{ fontSize: 15 }}>{persona.name}</b>
            )}
            <span className={`role-badge role-${bidderRole(persona, rules)}`}>{bidderRole(persona, rules)} bidder</span>
            {roundsFor(persona).map((r) => (
              <span key={r.id} className={`pill ${active?.id === r.id ? "v-ok" : "st-encumbered"}`}>{r.name}{active?.id === r.id ? " · active" : ""}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: "var(--ink-2)" }}>
            <span><GradeChip g={persona.grade} /> {GRADE_NAMES[persona.grade]}</span>
            <span>{current ? `${current.title}, ${currentPost!.city}` : "Between assignments"}</span>
            <span>{persona.ted ? `TED ${persona.ted}` : "Available now"}</span>
            <span>{persona.languages.length ? persona.languages.join(", ") : "No tested languages"}</span>
          </div>
          {admin && (
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
              You&apos;re viewing this list as the bidding admin. Edits are only possible while the officer&apos;s round is open.
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <strong>{rules.cycleLabel} bid list</strong>
          <span style={{ color: "var(--ink-3)", fontSize: 12 }}>{rows.length} positions{matches ? " matching search" : ""}</span>
          {biddingOpen && (
            <div className="seg" style={{ marginLeft: "auto" }}>
              <button aria-pressed={show === "eligible"} onClick={() => setShow("eligible")}>Ones I can bid on</button>
              <button aria-pressed={show === "all"} onClick={() => setShow("all")}>Everything</button>
            </div>
          )}
        </div>

        {biddingOpen && full && (
          <div className="banner" style={{ marginBottom: 10 }}>Your list is full ({myBids.length} of {max}). Remove a bid to add a different one.</div>
        )}
        {groups.map((g) => (
          <section key={g.key} className="bgroup" aria-label={g.label}>
            {biddingOpen && (
              <header className="bgroup-h">
                {g.grade && <GradeChip g={g.grade} />}
                <h3>{g.label}</h3>
                <span className="n">{g.rows.length}</span>
                {g.rule && <span className={`rule ${g.rule.ok ? "v-ok" : "v-warn"}`}>{g.rule.text}</span>}
              </header>
            )}
            {g.capped && (
              <div className="capnote">
                You&apos;ve already used your {g.label.toLowerCase()} bid{g.onList.length ? ` (${g.onList.join(", ")})` : ""}, so you can&apos;t bid on any more of these.
                Remove it from your list to choose a different one.
              </div>
            )}
            {(g.capped ? g.rows.filter((x) => mySet.has(x.p.id)) : g.rows).map(({ p, e }) => {
              const post = lk.postById.get(p.postId)!;
              const inc = lk.officerByPosition.get(p.id);
              const nb = bidsByPosition.get(p.id)?.length ?? 0;
              return (
                <div key={p.id} className={`brow ${biddingOpen ? e.verdict : ""}${mySet.has(p.id) ? " mine" : ""}`}>
                  <GradeChip g={p.grade} />
                  <button className="link t" style={{ color: "var(--ink)" }} onClick={() => select({ kind: "position", id: p.id })}>
                    {post.city} · {p.title}
                  </button>
                  {!biddingOpen ? (
                    <span />
                  ) : mySet.has(p.id) ? (
                    <button className="btn sm" disabled={locked} onClick={() => setMyBids(myBids.filter((b) => b.positionId !== p.id))}>
                      Remove #{myBids.findIndex((b) => b.positionId === p.id) + 1}
                    </button>
                  ) : (
                    <button className="btn sm primary" disabled={e.verdict === "blocked" || locked || full || g.capped} onClick={() => add(p.id)}>Add bid</button>
                  )}
                  <span className="s">
                    <StatusPill s={status.get(p.id)!} />
                    <span>{inc ? `TED ${inc.ted}` : "Vacant now"}</span>
                    <span>{post.hardship}% hardship</span>
                    {p.languageReq && <span>{p.languageReq}</span>}
                    {(admin || biddingOpen) && <span className="bidn">{nb} bidder{nb === 1 ? "" : "s"}</span>}
                  </span>
                  {biddingOpen && e.reasons.length > 0 && <span className={`why v-${e.verdict}`}>{e.reasons.join(" · ")}</span>}
                </div>
              );
            })}
          </section>
        ))}
        {rows.length === 0 && <div style={{ color: "var(--ink-3)", padding: 12 }}>Nothing on the list fits these filters.</div>}
      </section>

      <section>
        {!biddingOpen && roundStatusCard()}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{admin ? "Bids" : "My bids"}</h2>
          <span className="mono" style={{ color: "var(--ink-3)", fontSize: 12 }}>{myBids.length}/{max}</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "4px 0 8px" }}>
          {biddingOpen ? "Drag or use the arrows to rank. Rank 1 is your top choice." : "Read only until a round you're in is active."}
        </p>
        {myBids.length === 0 && <div style={{ color: "var(--ink-3)", padding: "12px 0" }}>{biddingOpen ? "No bids yet. Add positions from the list." : "No bids."}</div>}
        {myBids.map((b, i) => {
          const p = lk.positionById.get(b.positionId);
          if (!p) return null;
          const post = lk.postById.get(p.postId)!;
          const e = evaluate(persona, p, lk, rules);
          return (
            <div
              key={b.positionId}
              className="mybid"
              draggable={!locked}
              onDragStart={() => setDrag(i)}
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={() => {
                if (drag !== null) move(drag, i);
                setDrag(null);
              }}
            >
              <span className="rk">{i + 1}</span>
              <span style={{ minWidth: 0 }}>
                <button className="link" style={{ color: "var(--ink)" }} onClick={() => select({ kind: "position", id: p.id })}>
                  <GradeChip g={p.grade} /> {post.city}
                </button>
                <div style={{ fontSize: 11.5, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title} · {gapLabel(e.gap)}</div>
                {e.verdict !== "ok" && <div className={`v-${e.verdict}`} style={{ fontSize: 11 }}>{e.reasons[0]}</div>}
              </span>
              {!locked && (
                <span className="ctl">
                  <button onClick={() => move(i, i - 1)} aria-label="Move up">↑</button>
                  <button onClick={() => move(i, i + 1)} aria-label="Move down">↓</button>
                  <button onClick={() => setMyBids(myBids.filter((x) => x.positionId !== b.positionId))} aria-label="Remove">✕</button>
                </span>
              )}
            </div>
          );
        })}

        {biddingOpen && <div className="checks">
          {checks.map((c) => (
            <div key={c.label} className="check">
              <span className={`ic ${c.ok ? "v-ok" : "v-blocked"}`}>{c.ok ? "✓" : "✕"}</span>
              <span><b>{c.label}</b> · <span style={{ color: "var(--ink-2)" }}>{c.detail}</span></span>
            </div>
          ))}
        </div>}
        {submitted ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="submitted">Bid list submitted for the {rules.cycleLabel} cycle.</div>
            {biddingOpen && <button className="btn" onClick={() => setSubmitted(false)}>Withdraw and edit</button>}
          </div>
        ) : !biddingOpen ? null : (
          <button className="btn primary" disabled={!allOk || role === "not-bidding"} onClick={() => setSubmitted(true)} style={{ width: "100%" }}>
            Submit bid list
          </button>
        )}
        {biddingOpen && !allOk && !submitted && <p style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Fix the failing checks to submit.</p>}
        <div style={{ marginTop: 16 }}>
          <VerdictPill v="warn" /> <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>means language training would be added before arrival.</span>
        </div>
      </section>
    </div>
  );
}
