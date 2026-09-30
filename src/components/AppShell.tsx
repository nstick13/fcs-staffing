"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useApp, type Role, type View } from "./AppProvider";
import ColumnsView from "./ColumnsView";
import TableView from "./TableView";
import BiddingView from "./BiddingView";
import AdminView from "./AdminView";
import BidListView from "./BidListView";
import RosterView from "./RosterView";
import BidMatrixView from "./BidMatrixView";
import DetailPanel from "./DetailPanel";
import { SearchIcon } from "./ui";
import { GRADES } from "@/lib/grades";
import { windowLabel } from "@/lib/rounds";
import type { ColorBy, MapMode } from "./MapView";
import type { CycleStatus, Region } from "@/lib/types";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="map" /> });

const REGIONS: Region[] = ["Middle East & Africa", "Asia", "Europe", "Western Hemisphere", "Washington", "U.S. Field"];
const REGION_SHORT: Record<Region, string> = {
  "Middle East & Africa": "MEA",
  Asia: "Asia",
  Europe: "Europe",
  "Western Hemisphere": "WH",
  Washington: "DC",
  "U.S. Field": "U.S. field",
};
const STATUSES: { s: CycleStatus; label: string }[] = [
  { s: "on-cycle", label: "On-cycle" },
  { s: "off-cycle", label: "Off-cycle" },
  { s: "vacant", label: "Vacant" },
  { s: "encumbered", label: "Not on list" },
];

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export default function AppShell() {
  const { view, setView, role, setRole, filters, setFilters, visible, matches, data, rules, selection, source, showBidding, personaCanBid, biddingOn, active, personaId, setPersonaId } = useApp();
  const [mode, setMode] = useState<MapMode>("people");
  const myOpenRound = personaCanBid ? active : null;
  const people = [...data.officers].sort((a, b) => a.name.localeCompare(b.name));
  const [colorBy, setColorBy] = useState<ColorBy>("grade");

  const tabs: { v: View; label: string }[] = [
    { v: "map", label: "Map" },
    { v: "roster", label: "Roster" },
    { v: "columns", label: "Columns" },
    { v: "table", label: "Positions" },
    ...(role === "officer" && biddingOn ? [{ v: "bidding" as View, label: "Bidding" }] : []),
    ...(role === "officer" && biddingOn && rules.matrixForOfficers ? [{ v: "matrix" as View, label: "Bid matrix" }] : []),
    ...(role === "admin"
      ? [
          { v: "matrix" as View, label: "Bid matrix" },
          { v: "bidding" as View, label: "Bid lists" },
          { v: "bidlist" as View, label: "Manage bidding" },
          { v: "admin" as View, label: "Rules" },
        ]
      : []),
  ];
  // an officer whose round closes loses the My bids tab; send them back to the map
  const activeView =
    role === "officer" && ((view === "bidding" && !biddingOn) || (view === "matrix" && !(biddingOn && rules.matrixForOfficers))) ? "map" : view;
  const shown = matches ? matches.size : visible.length;
  const effectiveColor: ColorBy =
    (!showBidding && (colorBy === "demand" || colorBy === "eligibility")) || (role === "admin" && colorBy === "eligibility") ? "grade" : colorBy;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div>
            <span className="eyebrow-org">U.S. &amp; Foreign Commercial Service</span>
            <h1>FCS Staffing</h1>
          </div>
          <span className="cycle">
            {rules.cycleLabel} · {!biddingOn ? "bidding off" : active ? `${active.name.split("·")[0].trim()} active` : "bid list posted"}
          </span>
          {source === "local" && <span className="mock">Demo · mock data</span>}
        </div>
        <nav className="tabs" aria-label="Views">
          {tabs.map((t) => (
            <button key={t.v} aria-pressed={activeView === t.v} onClick={() => setView(t.v)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="role">
          <label htmlFor="role">View as</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="viewer">Viewer</option>
            <option value="officer">Officer</option>
            <option value="admin">Bidding admin</option>
          </select>
          {role === "officer" && (
            <>
              <label htmlFor="me">signed in as</label>
              <select id="me" value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
                {people.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.grade})</option>
                ))}
              </select>
            </>
          )}
        </div>
      </header>

      <div className="filters">
        <div className="search">
          <SearchIcon />
          <input
            id="q"
            type="search"
            placeholder="Search post, country, officer, language…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <div className="chips" role="group" aria-label="Region">
          {REGIONS.map((r) => (
            <button key={r} className="chip" aria-pressed={filters.regions.includes(r)} onClick={() => setFilters((f) => ({ ...f, regions: toggle(f.regions, r) }))} title={r}>
              {REGION_SHORT[r]}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Grade">
          {GRADES.map((g) => (
            <button key={g} className="chip g" aria-pressed={filters.grades.includes(g)} onClick={() => setFilters((f) => ({ ...f, grades: toggle(f.grades, g) }))}>
              {g}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Cycle status">
          {STATUSES.map(({ s, label }) => (
            <button key={s} className="chip" aria-pressed={filters.statuses.includes(s)} onClick={() => setFilters((f) => ({ ...f, statuses: toggle(f.statuses, s) }))}>
              {label}
            </button>
          ))}
        </div>
        {(filters.q || filters.regions.length || filters.grades.length || filters.statuses.length) ? (
          <button className="btn sm" onClick={() => setFilters({ q: "", regions: [], grades: [], statuses: [] })}>Clear</button>
        ) : null}
        <span className="count">
          <b>{shown}</b> of {data.positions.length} positions
        </span>
      </div>

      {role === "officer" && myOpenRound && activeView !== "bidding" && (
        <div className="bidbar">
          <span><b>{myOpenRound.name}</b> is active and you&apos;re in it. {windowLabel(myOpenRound)}.</span>
          <button className="btn sm primary" onClick={() => setView("bidding")}>Go to my bids</button>
        </div>
      )}
      <div className="main">
        <div className="view">
          {activeView === "map" && (
            <>
              <MapView colorBy={effectiveColor} mode={mode} />
              <div className="mapctl">
                <div className="seg" role="group" aria-label="Map mode">
                  <button aria-pressed={mode === "positions"} onClick={() => setMode("positions")}>Positions</button>
                  <button aria-pressed={mode === "people"} onClick={() => setMode("people")}>Who&apos;s where</button>
                </div>
                {mode === "positions" && (
                  <div className="seg" role="group" aria-label="Color by">
                    <button aria-pressed={effectiveColor === "grade"} onClick={() => setColorBy("grade")}>Grade</button>
                    <button aria-pressed={effectiveColor === "status"} onClick={() => setColorBy("status")}>Cycle</button>
                    <button aria-pressed={effectiveColor === "hardship"} onClick={() => setColorBy("hardship")}>Hardship</button>
                    {showBidding && <button aria-pressed={effectiveColor === "demand"} onClick={() => setColorBy("demand")}>Demand</button>}
                    {role === "officer" && showBidding && <button aria-pressed={effectiveColor === "eligibility"} onClick={() => setColorBy("eligibility")}>Can I bid?</button>}
                  </div>
                )}
              </div>
            </>
          )}
          {activeView === "roster" && <RosterView />}
          {activeView === "columns" && <ColumnsView />}
          {activeView === "table" && <TableView />}
          {activeView === "matrix" && (role === "admin" || (biddingOn && rules.matrixForOfficers)) && <BidMatrixView />}
          {activeView === "bidding" && (role === "admin" || biddingOn) && <BiddingView />}
          {activeView === "bidlist" && role === "admin" && <BidListView />}
          {activeView === "admin" && role === "admin" && <AdminView />}
        </div>
        {selection && <DetailPanel />}
      </div>
    </div>
  );
}
