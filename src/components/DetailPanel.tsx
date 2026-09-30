"use client";

import { useApp } from "./AppProvider";
import { GradeChip, StatusPill, VerdictPill, gapLabel } from "./ui";
import { GRADES, GRADE_NAMES, gradeGap } from "@/lib/grades";
import { bidderRole, evaluate } from "@/lib/rules";

const TYPE: Record<string, string> = { E: "Embassy", C: "Consulate", M: "Multilateral mission", H: "Headquarters", D: "Domestic field" };

export default function DetailPanel() {
  const { selection, select, lk, data, status, bidsByPosition, role, persona, myBids, setMyBids, rules, submitted, personaCanBid, showBidding, edits, setOverride, deletePosition, assigned } = useApp();
  const locked = submitted || !personaCanBid;
  if (!selection) return null;

  const close = (
    <button className="close" onClick={() => select(null)} aria-label="Close details">
      ✕
    </button>
  );

  if (selection.kind === "post") {
    const post = lk.postById.get(selection.id);
    if (!post) return null;
    const list = data.positions
      .filter((p) => p.postId === post.id)
      .sort((a, b) => GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade));
    const open = list.filter((p) => status.get(p.id) !== "encumbered").length;
    return (
      <aside className="panel">
        {close}
        <div>
          <div className="eyebrow">{post.region} · {post.subregion}</div>
          <h2>{post.city}</h2>
          <div style={{ color: "var(--ink-2)" }}>{post.country}</div>
        </div>
        <dl className="kv">
          <dt>Post code</dt><dd className="mono">{post.id}</dd>
          <dt>Type</dt><dd>{TYPE[post.type]}</dd>
          <dt>Hardship</dt><dd>{post.hardship}% differential</dd>
          <dt>Tour</dt><dd>{post.tourYears} years</dd>
          <dt>Language</dt><dd>{post.language ?? "English"}</dd>
          <dt>Positions</dt><dd>{list.length} · {open} on the {rules.cycleLabel} list</dd>
        </dl>
        <div className="sect">
          <h3>Staffing pattern</h3>
          <div className="list">
            {list.map((p) => {
              const inc = lk.officerByPosition.get(p.id);
              return (
                <div key={p.id} className="lrow">
                  <GradeChip g={p.grade} />
                  <span className="grow">
                    <button className="link" onClick={() => select({ kind: "position", id: p.id })}>{p.title}</button>
                    <br />
                    <span style={{ color: inc ? "var(--ink-2)" : "var(--bad)" }}>{inc ? `${inc.name} (${inc.grade})` : "Vacant"}</span>
                  </span>
                  <StatusPill s={status.get(p.id)!} />
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    );
  }

  const p = lk.positionById.get(selection.id);
  if (!p) return null;
  const post = lk.postById.get(p.postId)!;
  const inc = lk.officerByPosition.get(p.id);
  const st = status.get(p.id)!;
  const bids = (bidsByPosition.get(p.id) ?? []).slice().sort((a, b) => a.rank - b.rank);
  const officerById = new Map(data.officers.map((o) => [o.id, o]));
  const elig = role === "officer" && personaCanBid ? evaluate(persona, p, lk, rules) : null;
  const onList = myBids.some((b) => b.positionId === p.id);
  const incGap = inc ? gradeGap(inc.grade, p.grade) : 0;
  const incoming = lk.incoming?.get(p.id);
  const filledBy = data.officers.find((o) => assigned[o.id]?.positionId === p.id);

  return (
    <aside className="panel">
      {close}
      <div>
        <div className="eyebrow">
          <button className="link" onClick={() => select({ kind: "post", id: post.id })}>{post.city}, {post.country}</button>
        </div>
        <h2>{p.title}</h2>
        <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
          <GradeChip g={p.grade} />
          <span style={{ color: "var(--ink-2)", fontSize: 12 }}>{GRADE_NAMES[p.grade]}</span>
          <StatusPill s={st} />
        </div>
      </div>

      {elig && (
        <div className="sect">
          <h3>For {persona.name}</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
            <VerdictPill v={elig.verdict} />
            <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{gapLabel(elig.gap)} · {bidderRole(persona, rules)} bidder</span>
          </div>
          {elig.reasons.length > 0 && (
            <ul className="reasons">{elig.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          )}
          <div style={{ marginTop: 8 }}>
            {onList ? (
              <button className="btn" disabled={locked} onClick={() => setMyBids(myBids.filter((b) => b.positionId !== p.id))}>Remove from my bids</button>
            ) : (
              <button className="btn primary" disabled={elig.verdict === "blocked" || locked} onClick={() => setMyBids([...myBids, { officerId: persona.id, positionId: p.id, rank: myBids.length + 1 }])}>
                Add to my bids
              </button>
            )}
          </div>
        </div>
      )}

      <dl className="kv">
        <dt>Position</dt><dd className="mono">{p.id}</dd>
        <dt>Specialty</dt><dd>{p.specialty ?? "None"}</dd>
        <dt>Language</dt><dd>{p.languageReq ? `${p.languageReq} (designated)` : "Not designated"}</dd>
        <dt>Tour</dt><dd>{post.tourYears} years</dd>
        <dt>Incumbent</dt>
        <dd>
          {inc ? (
            <>
              {inc.name} <span className="mono">({inc.grade})</span>
              {incGap !== 0 && <span style={{ color: "var(--ink-3)" }}> · {incGap > 0 ? "stretch" : "stoop"}</span>}
              <br />
              <span style={{ color: "var(--ink-2)" }}>TED {inc.ted}{inc.languages.length ? ` · ${inc.languages.join(", ")}` : ""}</span>
            </>
          ) : (
            <span style={{ color: "var(--bad)", fontWeight: 600 }}>Vacant</span>
          )}
        </dd>
        <dt>Hardship</dt>
        <dd>{post.hardship}%{post.hardship >= rules.hardshipThreshold ? " (counts toward the hardship bid)" : ""}</dd>
        {filledBy && (
          <>
            <dt>Assigned</dt>
            <dd>{filledBy.name} <span className="mono">({filledBy.grade})</span>, this cycle</dd>
          </>
        )}
        {incoming && (
          <>
            <dt>Incoming</dt>
            <dd>
              {incoming.name} <span className="mono">({incoming.grade})</span>
              <br />
              <span style={{ color: "var(--accent)" }}>In {incoming.training!.language} training until {incoming.training!.until}</span>
            </dd>
          </>
        )}
      </dl>

      {role === "admin" && (
        <div className="sect">
          <h3>Bid list</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {st === "encumbered" ? (
              <button className="btn primary" onClick={() => setOverride(p.id, edits.overrides[p.id] === "remove" ? null : "add")}>Put on bid list</button>
            ) : (
              <button className="btn" onClick={() => setOverride(p.id, edits.overrides[p.id] === "add" ? null : "remove")}>Take off bid list</button>
            )}
            <button className="btn" onClick={() => { deletePosition(p.id); select(null); }}>Delete position</button>
            {edits.overrides[p.id] && <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Changed by admin</span>}
          </div>
        </div>
      )}

      {showBidding && role !== "admin" && (
        <div className="sect">
          <h3>Bidders</h3>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{bids.length} officer{bids.length === 1 ? " has" : "s have"} bid on this position.</div>
        </div>
      )}
      {role === "admin" && (
        <div className="sect">
          <h3>Bidders ({bids.length})</h3>
          {bids.length === 0 ? (
            <div style={{ color: "var(--ink-3)", fontSize: 12.5 }}>No bids yet.</div>
          ) : (
            <div className="list">
              {bids.map((b) => {
                const o = officerById.get(b.officerId)!;
                const g = gradeGap(o.grade, p.grade);
                return (
                  <div key={b.officerId} className="lrow">
                    <GradeChip g={o.grade} />
                    <span className="grow">{o.name}{o.id === persona.id ? " (you)" : ""}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{gapLabel(g)} · rank {b.rank}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
