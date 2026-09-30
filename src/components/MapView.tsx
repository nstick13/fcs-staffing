"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { useApp } from "./AppProvider";
import { declutter, type Box } from "@/lib/declutter";
import { GRADES, gradeGap } from "@/lib/grades";
import { evaluate } from "@/lib/rules";
import type { Position, Post } from "@/lib/types";

export type ColorBy = "grade" | "status" | "hardship" | "demand" | "eligibility";
export type MapMode = "positions" | "people";

interface Props {
  colorBy: ColorBy;
  mode: MapMode;
}

function cellSpec(z: number) {
  if (z <= 2) return { w: 7, h: 7, gap: 1, label: false, title: false };
  if (z === 3) return { w: 9, h: 9, gap: 1.5, label: false, title: false };
  if (z === 4) return { w: 13, h: 13, gap: 2, label: false, title: true };
  return { w: 24, h: 16, gap: 2, label: true, title: true };
}

const initials = (n: string) => n.split(/\s+/).map((s) => s[0]).join("").slice(0, 2);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const FSI = { lat: 38.871, lng: -77.115 }; // Foreign Service Institute, Arlington

function hardshipColor(h: number) {
  if (h === 0) return "c-none";
  const t = Math.min(1, h / 35);
  const l = 80 - t * 42;
  return `background:hsl(${24 - t * 16} 80% ${l}%);color:${l < 56 ? "#fff" : "#142033"}`;
}

function demandColor(n: number) {
  if (n === 0) return "c-none";
  const t = Math.min(1, n / 8);
  const l = 78 - t * 45;
  return `background:hsl(${28 - t * 22} 85% ${l}%);color:${l < 55 ? "#fff" : "#142033"}`;
}

export default function MapView({ colorBy, mode }: Props) {
  const app = useApp();
  const { lk, status, bidsByPosition, visible, matches, selection, select, persona, myBids, rules, trainees } = app;
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [zoom, setZoom] = useState(2);
  const [tip, setTip] = useState<{ x: number; y: number; html: string } | null>(null);

  // positions grouped by post, in grade order (senior first)
  const byPost = useMemo(() => {
    const m = new Map<string, Position[]>();
    for (const p of visible) m.set(p.postId, [...(m.get(p.postId) ?? []), p]);
    for (const list of m.values()) list.sort((a, b) => GRADES.indexOf(b.grade) - GRADES.indexOf(a.grade));
    return m;
  }, [visible]);

  const myBidSet = useMemo(() => new Set(myBids.map((b) => b.positionId)), [myBids]);

  // one-time map setup
  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, {
      center: [25, 15],
      zoom: 2,
      minZoom: 2,
      maxZoom: 8,
      zoomSnap: 1,
      worldCopyJump: false,
      maxBounds: [[-75, -220], [85, 220]],
      attributionControl: false,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
    const land = feature(topo, topo.objects.countries);
    // Russia and Fiji cross the date line; shift their western points east so no ring spans the globe
    for (const f of land.features) {
      const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
      for (const rings of polys)
        for (const ring of rings) {
          const lngs = ring.map((c) => c[0]);
          if (Math.max(...lngs) - Math.min(...lngs) > 180) for (const c of ring) if (c[0] < 0) c[0] += 360;
        }
    }
    land.features = land.features.filter((f) => (f.properties as { name?: string } | null)?.name !== "Antarctica");
    L.geoJSON(land, {
      style: { className: "land" },
      interactive: false,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on("zoomend", () => setZoom(map.getZoom()));
    mapRef.current = map;

    const container = el.current;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const cell = t.closest<HTMLElement>("[data-pos]");
      if (cell) return select({ kind: "position", id: cell.dataset.pos! });
      const head = t.closest<HTMLElement>("[data-post]");
      if (head) {
        select({ kind: "post", id: head.dataset.post! });
        if (map.getZoom() < 5) map.setView(map.containerPointToLatLng(map.mouseEventToContainerPoint(e)), 5);
      }
    };
    const onMove = (e: MouseEvent) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
      if (!cell) return setTip(null);
      const r = container.getBoundingClientRect();
      setTip({ x: e.clientX - r.left + 14, y: e.clientY - r.top + 14, html: cell.dataset.tip! });
    };
    container.addEventListener("click", onClick);
    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", () => setTip(null));
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [select]); // select is a state setter, so this runs once

  // draw
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const spec = cellSpec(zoom);
    const selPos = selection?.kind === "position" ? selection.id : null;
    const selPost = selection?.kind === "post" ? selection.id : selPos ? lk.positionById.get(selPos)?.postId : null;

    const visibleIds = new Set(visible.map((p) => p.id));
    const pipeline = mode === "people" ? trainees.filter((o) => visibleIds.has(o.training!.onwardPositionId)) : [];
    const fsiPost: Post = { id: "FSI", city: "Language training · FSI", country: "United States", region: "Washington", subregion: "Training", lat: FSI.lat, lng: FSI.lng, type: "H", hardship: 0, language: null, tourYears: 1 };
    const groups: [string, Position[]][] = [...byPost];
    if (pipeline.length) groups.push(["FSI", pipeline.map((o) => lk.positionById.get(o.training!.onwardPositionId)!)]);

    const items: { post: Post; list: Position[]; cols: number; box: Box }[] = [];
    for (const [postId, list] of groups) {
      const post = postId === "FSI" ? fsiPost : lk.postById.get(postId)!;
      const n = list.length;
      const cols = n <= 4 ? n : n <= 8 ? Math.ceil(n / 2) : Math.min(6, Math.ceil(Math.sqrt(n * 1.6)));
      const rows = Math.ceil(n / cols);
      const gridW = cols * spec.w + (cols - 1) * spec.gap;
      const titleW = spec.title ? post.city.length * 6.2 + 22 + (post.hardship ? 30 : 0) : 0;
      const w = Math.max(gridW, titleW) + 8;
      const h = rows * spec.h + (rows - 1) * spec.gap + 8 + (spec.title ? 14 : 0);
      const pt = map.latLngToLayerPoint([post.lat, post.lng]);
      items.push({ post, list, cols, box: { id: postId, ax: pt.x, ay: pt.y, w, h, x: 0, y: 0 } });
    }
    declutter(items.map((i) => i.box), zoom <= 2 ? 2 : 4);

    for (const { post, list, cols, box } of items) {
      const dx = box.x - box.ax;
      const dy = box.y - box.ay;
      const isFsi = post.id === "FSI";
      const postMatch = !matches || list.some((p) => matches.has(p.id));
      const cells = list
        .map((p) => {
          if (isFsi) {
            const o = lk.incoming!.get(p.id)!;
            const dest = lk.postById.get(p.postId)!;
            const cls = ["cell", "lt"];
            if (matches && !matches.has(p.id)) cls.push("dim");
            if (p.id === selPos) cls.push("sel");
            const t = `<b>${esc(o.name)} · ${o.grade}</b><span class="m">${esc(o.training!.language)} training until ${o.training!.until}<br>then ${esc(dest.city)} · ${p.grade} ${esc(p.title)}</span>`;
            return `<span class="${cls.join(" ")}" style="width:${spec.w}px;height:${spec.h}px" data-pos="${p.id}" data-tip="${esc(t)}">${spec.label ? initials(o.name) : ""}</span>`;
          }
          const st = status.get(p.id)!;
          const inc = lk.officerByPosition.get(p.id);
          const nb = bidsByPosition.get(p.id)?.length ?? 0;
          const cls = ["cell"];
          let style = "";
          let label: string = p.grade;
          if (mode === "people") {
            if (inc) {
              cls.push(`g-${inc.grade}`);
              label = initials(inc.name);
              const g = gradeGap(inc.grade, p.grade);
              if (g > 0) cls.push("stretch");
              if (g < 0) cls.push("stoop");
            } else cls.push("vac");
          } else {
            if (!inc) cls.push("vac");
            if (colorBy === "grade") {
              cls.push(`g-${p.grade}`);
              if (st === "on-cycle") cls.push("ring");
            } else if (colorBy === "status") cls.push(`c-${st}`);
            else if (colorBy === "demand") {
              const d = demandColor(nb);
              if (d.startsWith("c-")) cls.push(d);
              else style = d;
            } else if (colorBy === "hardship") {
              const d = hardshipColor(post.hardship);
              if (d.startsWith("c-")) cls.push(d);
              else style = d;
            } else if (colorBy === "eligibility") {
              if (myBidSet.has(p.id)) cls.push("c-mine");
              else cls.push(`c-${evaluate(persona, p, lk, rules).verdict}`);
            }
          }
          const incoming = lk.incoming?.get(p.id);
          if (matches && !matches.has(p.id)) cls.push("dim");
          if (p.id === selPos) cls.push("sel");
          const who = inc ? `${esc(inc.name)} · ${inc.grade}${inc.ted ? ` · TED ${inc.ted}` : ""}` : "Vacant";
          const tipHtml = `<b>${esc(post.city)} · ${p.grade} ${esc(p.title)}</b><span class="m">${who}<br>${st.replace("-", " ")} · ${nb} bid${nb === 1 ? "" : "s"} · ${post.hardship}% hardship${p.languageReq ? ` · ${esc(p.languageReq)}` : ""}${incoming ? `<br>Incoming: ${esc(incoming.name)} (in ${esc(incoming.training!.language)} training)` : ""}</span>`;
          return `<span class="${cls.join(" ")}" style="width:${spec.w}px;height:${spec.h}px;${style}" data-pos="${p.id}" data-tip="${esc(tipHtml)}">${spec.label ? label : ""}</span>`;
        })
        .join("");
      const dist = Math.hypot(dx, dy + box.h / 2 + 7);
      const leader = dist > 3 ? `<svg class="leader" width="1" height="1"><line x1="0" y1="0" x2="${dx}" y2="${dy}"/></svg>` : "";
      const title = spec.title
        ? `<div class="pbox-t"${isFsi ? "" : ` data-post="${post.id}"`}>${esc(post.city)}<span>${list.length}</span>${post.hardship ? `<span class="hd">${post.hardship}%</span>` : ""}</div>`
        : "";
      const html = `<div class="pc">${leader}<span class="pin"></span><div class="pbox${isFsi ? " fsi" : ""}${postMatch ? "" : " dim"}${post.id === selPost ? " selpost" : ""}" style="left:${dx - box.w / 2}px;top:${dy - box.h / 2}px;width:${box.w}px" ${spec.title || isFsi ? "" : `data-post="${post.id}"`}>${title}<div class="pgrid" style="grid-template-columns:repeat(${cols},${spec.w}px);gap:${spec.gap}px">${cells}</div></div></div>`;
      L.marker([post.lat, post.lng], {
        icon: L.divIcon({ html, className: "", iconSize: [0, 0] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: postMatch ? 1000 : 0,
      }).addTo(layer);
    }
  }, [byPost, zoom, lk, status, bidsByPosition, colorBy, mode, matches, selection, persona, rules, myBidSet, trainees, visible]);

  // zoom to search results
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !matches || matches.size === 0) return;
    const t = setTimeout(() => {
      const pts = [...matches].map((id) => {
        const post = lk.postById.get(lk.positionById.get(id)!.postId)!;
        return L.latLng(post.lat, post.lng);
      });
      if (pts.length === 1) map.setView(pts[0], Math.max(map.getZoom(), 5));
      else map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 5 });
    }, 450);
    return () => clearTimeout(t);
  }, [matches, lk]);

  // fly to the selected post when chosen elsewhere (columns, table, panel)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selection) return;
    const postId = selection.kind === "post" ? selection.id : lk.positionById.get(selection.id)?.postId;
    const post = postId ? lk.postById.get(postId) : null;
    if (post && !map.getBounds().pad(-0.1).contains([post.lat, post.lng])) map.panTo([post.lat, post.lng]);
  }, [selection, lk]);

  return (
    <>
      <div ref={el} className="map" />
      {tip && <div className="maptip" style={{ left: tip.x, top: tip.y }} dangerouslySetInnerHTML={{ __html: tip.html }} />}
      <Legend colorBy={colorBy} mode={mode} bidder={app.showBidding} zoom={zoom} />
    </>
  );
}

function Legend({ colorBy, mode, zoom }: { colorBy: ColorBy; mode: MapMode; bidder: boolean; zoom: number }) {
  const grades = (
    <div className="row">
      {GRADES.map((g) => (
        <span key={g} className="sw">
          <i className={`g-${g}`} />
          <span className="mono">{g}</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="legend">
      {mode === "people" ? (
        <>
          <div>Officer grade · initials at zoom 5+</div>
          {grades}
          <div className="row">
            <span className="sw"><i style={{ boxShadow: "inset 0 0 0 1.5px var(--bad)" }} /> vacant</span>
            <span className="sw"><i style={{ background: "linear-gradient(45deg, transparent 60%, var(--bad) 60%)" }} /> stretch</span>
            <span className="sw"><i style={{ background: "linear-gradient(135deg, transparent 60%, var(--ok) 60%)" }} /> stoop</span>
          </div>
          <div className="row">
            <span className="sw"><i style={{ boxShadow: "inset 0 0 0 1.5px var(--accent)", borderRadius: 6 }} /> in language training (FSI)</span>
          </div>
        </>
      ) : colorBy === "grade" ? (
        <>
          {grades}
          <div className="row">
            <span className="sw"><i style={{ boxShadow: "0 0 0 2px var(--on-cycle)" }} /> opens on-cycle</span>
            <span className="sw"><i style={{ boxShadow: "inset 0 0 0 1.5px var(--bad)" }} /> vacant</span>
          </div>
        </>
      ) : colorBy === "status" ? (
        <div className="row">
          <span className="sw"><i className="c-on-cycle" /> on-cycle</span>
          <span className="sw"><i className="c-off-cycle" /> off-cycle</span>
          <span className="sw"><i style={{ boxShadow: "inset 0 0 0 1.5px var(--bad)" }} /> vacant</span>
          <span className="sw"><i className="c-encumbered" /> not on list</span>
        </div>
      ) : colorBy === "hardship" ? (
        <div className="row">
          <span className="sw"><i className="c-none" /> 0%</span>
          {[10, 20, 30].map((h) => (
            <span key={h} className="sw">
              <i style={{ background: `hsl(${24 - Math.min(1, h / 35) * 16} 80% ${80 - Math.min(1, h / 35) * 42}%)` }} /> {h}%{h === 30 ? "+" : ""}
            </span>
          ))}
        </div>
      ) : colorBy === "demand" ? (
        <div className="row">
          <span className="sw"><i className="c-none" /> 0 bids</span>
          {[2, 4, 8].map((n) => (
            <span key={n} className="sw">
              <i style={{ background: `hsl(${28 - Math.min(1, n / 8) * 22} 85% ${78 - Math.min(1, n / 8) * 45}%)` }} /> {n === 8 ? "8+" : n}
            </span>
          ))}
        </div>
      ) : (
        <div className="row">
          <span className="sw"><i className="c-mine" /> on my list</span>
          <span className="sw"><i className="c-ok" /> eligible</span>
          <span className="sw"><i className="c-warn" /> needs training</span>
          <span className="sw"><i className="c-blocked" /> not eligible</span>
        </div>
      )}
      {zoom < 5 && <div style={{ color: "var(--ink-3)" }}>Zoom in for grade labels. Click a box to open the post.</div>}
    </div>
  );
}
