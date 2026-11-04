"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, MapPin, Maximize2, RefreshCw, ShieldCheck, ZoomIn, ZoomOut } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { tr } from "@/lib/i18n";
import type { Category, Priority, ReportStatus } from "@/lib/types";

const CAMPUS_CENTER = { latitude: 27.451394583530963, longitude: 94.88989891121943 };
const INITIAL_ZOOM = 16;
const TILE_SIZE = 256;
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "© OpenStreetMap contributors";
const TILE_ATTRIBUTION_URL = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION_URL || "https://www.openstreetmap.org/copyright";
type Coordinate = { latitude: number; longitude: number };
type MapReport = {
  id: string;
  ticketNumber: string;
  titleEn: string | null;
  titleAs: string | null;
  category: Category;
  priority: Priority;
  status: ReportStatus;
  building: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
};
type Tile = { key: string; src: string; left: number; top: number };

function project(point: Coordinate, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const latitude = Math.max(-85.0511, Math.min(85.0511, point.latitude));
  const sin = Math.sin(latitude * Math.PI / 180);
  return {
    x: (point.longitude + 180) / 360 * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function unproject(x: number, y: number, zoom: number): Coordinate {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = x / scale * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / scale;
  const latitude = 180 / Math.PI * Math.atan(Math.sinh(n));
  return { latitude, longitude };
}

function priorityClass(priority: Priority) {
  return priority.toLowerCase();
}

function hasPin(report: MapReport) {
  return typeof report.latitude === "number" && Number.isFinite(report.latitude)
    && typeof report.longitude === "number" && Number.isFinite(report.longitude);
}

export function CampusIssueMap() {
  const { user, locale, openReport } = useWorkspace();
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; centerX: number; centerY: number } | null>(null);
  const [reports, setReports] = useState<MapReport[]>([]);
  const [center, setCenter] = useState<Coordinate>(CAMPUS_CENTER);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [size, setSize] = useState({ width: 720, height: 390 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workspace/issue-map", { cache: "no-store" });
      const body = await response.json() as { reports?: MapReport[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Campus reports could not be loaded.");
      setReports(body.reports || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Campus reports could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh, user.role, user.department]);
  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.max(320, Math.round(entry.contentRect.width)), height: Math.max(280, Math.round(entry.contentRect.height)) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const locatedReports = useMemo(() => reports.filter(hasPin), [reports]);
  const withoutPin = reports.length - locatedReports.length;
  const centerPixel = project(center, zoom);
  const mapLeft = centerPixel.x - size.width / 2;
  const mapTop = centerPixel.y - size.height / 2;
  const tileWorldCount = 2 ** zoom;
  const tiles = useMemo<Tile[]>(() => {
    const minX = Math.floor(mapLeft / TILE_SIZE);
    const maxX = Math.ceil((mapLeft + size.width) / TILE_SIZE) - 1;
    const minY = Math.max(0, Math.floor(mapTop / TILE_SIZE));
    const maxY = Math.min(tileWorldCount - 1, Math.ceil((mapTop + size.height) / TILE_SIZE) - 1);
    const visible: Tile[] = [];
    for (let tileY = minY; tileY <= maxY; tileY += 1) {
      for (let tileX = minX; tileX <= maxX; tileX += 1) {
        const wrappedX = ((tileX % tileWorldCount) + tileWorldCount) % tileWorldCount;
        visible.push({
          key: `${zoom}/${wrappedX}/${tileY}`,
          src: TILE_URL.replaceAll("{z}", String(zoom)).replaceAll("{x}", String(wrappedX)).replaceAll("{y}", String(tileY)),
          left: tileX * TILE_SIZE - mapLeft,
          top: tileY * TILE_SIZE - mapTop,
        });
      }
    }
    return visible;
  }, [mapLeft, mapTop, size.height, size.width, tileWorldCount, zoom]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a")) return;
    const pixel = project(center, zoom);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, centerX: pixel.x, centerY: pixel.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setCenter(unproject(drag.centerX - (event.clientX - drag.x), drag.centerY - (event.clientY - drag.y), zoom));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function changeZoom(nextZoom: number) {
    setZoom(Math.max(5, Math.min(19, nextZoom)));
  }

  function fitReports() {
    if (!locatedReports.length) {
      setCenter(CAMPUS_CENTER);
      setZoom(INITIAL_ZOOM);
      return;
    }
    const points = locatedReports.map((report) => project({ latitude: report.latitude as number, longitude: report.longitude as number }, 0));
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const spanX = Math.max(maxX - minX, 0.0001);
    const spanY = Math.max(maxY - minY, 0.0001);
    const fitZoom = Math.floor(Math.min(Math.log2(Math.max(1, size.width - 100) / spanX), Math.log2(Math.max(1, size.height - 100) / spanY)));
    setCenter(unproject((minX + maxX) / 2, (minY + maxY) / 2, 0));
    setZoom(Math.max(5, Math.min(19, fitZoom)));
  }

  function reportName(report: MapReport) {
    return locale === "as" ? report.titleAs || report.titleEn || report.ticketNumber : report.titleEn || report.titleAs || report.ticketNumber;
  }

  return <section className="panel campus-map-panel">
    <div className="campus-map-heading">
      <div><div className="section-kicker">{tr(locale, "Live campus picture", "কেম্পাছৰ লাইভ চিত্ৰ")}</div><h2>{tr(locale, "Unresolved reports on the map", "মানচিত্ৰত সমাধান নোহোৱা প্ৰতিবেদন")}</h2><p>{user.role === "admin" ? tr(locale, "All active campus reports with a shared location pin.", "স্থান পিন দিয়া কেম্পাছৰ সকলো সক্ৰিয় প্ৰতিবেদন।") : tr(locale, "Active reports assigned to your department with a shared location pin.", "আপোনাৰ বিভাগক দিয়া স্থান পিনযুক্ত সক্ৰিয় প্ৰতিবেদন।")}</p></div>
      <button type="button" className="button button-outline button-small" onClick={() => void refresh(true)} disabled={loading || refreshing}><RefreshCw size={13} className={refreshing ? "spin-icon" : ""}/>{tr(locale, "Refresh", "পুনৰ লোড")}</button>
    </div>

    <div className="campus-map-summary"><span><strong>{reports.length}</strong>{tr(locale, " unresolved", "টা সমাধান নোহোৱা")}</span><span><strong>{locatedReports.length}</strong>{tr(locale, " with location pins", "টাত স্থান পিন আছে")}</span>{withoutPin > 0 && <span className="campus-map-unpinned"><ShieldCheck size={13}/>{withoutPin} {tr(locale, "without a shared pin", "টাত পিন দিয়া নাই")}</span>}</div>

    {error ? <div className="campus-map-error" role="alert"><MapPin size={18}/><p>{error}</p><button type="button" className="button button-outline button-small" onClick={() => void refresh(true)}>{tr(locale, "Try again", "পুনৰ চেষ্টা কৰক")}</button></div> : <div className="campus-map-layout">
      <div className="campus-map-frame" ref={mapRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onWheel={(event) => { if (event.deltaY) changeZoom(zoom + (event.deltaY < 0 ? 1 : -1)); }} style={{ touchAction: "none" }} aria-label={tr(locale, "Interactive map of unresolved campus reports", "কেম্পাছৰ সমাধান নোহোৱা প্ৰতিবেদনৰ ইণ্টাৰেক্টিভ মানচিত্ৰ")}>
        <div className="campus-map-tiles">{tiles.map((tile) => <div key={tile.key} className="campus-map-tile" style={{ left: tile.left, top: tile.top, backgroundImage: `url("${tile.src}")` }}/>)}</div>
        <div className="campus-map-markers">{locatedReports.map((report) => {
          const point = project({ latitude: report.latitude as number, longitude: report.longitude as number }, zoom);
          const x = point.x - mapLeft;
          const y = point.y - mapTop;
          if (x < -28 || y < -34 || x > size.width + 28 || y > size.height + 34) return null;
          return <button key={report.id} type="button" className={`campus-map-marker priority-${priorityClass(report.priority)}`} style={{ left: x, top: y }} title={`${report.ticketNumber} · ${reportName(report)} · ${report.priority}`} aria-label={`${report.ticketNumber}, ${reportName(report)}, ${report.priority}. Open report.`} onClick={(event) => { event.stopPropagation(); openReport(report.id); }}><MapPin size={30} fill="currentColor" stroke="white" strokeWidth={1.8}/><span>{report.priority === "Urgent" ? "!" : report.priority === "High" ? "↑" : report.priority === "Medium" ? "•" : "·"}</span></button>;
        })}</div>
        <div className="campus-map-controls" onPointerDown={(event) => event.stopPropagation()}><button type="button" aria-label={tr(locale, "Zoom in", "ওচৰলৈ আনক")} onClick={() => changeZoom(zoom + 1)}><ZoomIn size={16}/></button><button type="button" aria-label={tr(locale, "Zoom out", "দূৰলৈ নিনক")} onClick={() => changeZoom(zoom - 1)}><ZoomOut size={16}/></button><button type="button" aria-label={tr(locale, "Fit all report locations", "সকলো প্ৰতিবেদনৰ স্থান দেখুৱাওক")} onClick={fitReports}><Maximize2 size={15}/></button><button type="button" aria-label={tr(locale, "Return to campus", "কেম্পাছলৈ উভতি যাওক")} onClick={() => { setCenter(CAMPUS_CENTER); setZoom(INITIAL_ZOOM); }}><LocateFixed size={15}/></button></div>
        <a className="campus-map-attribution" href={TILE_ATTRIBUTION_URL} target="_blank" rel="noreferrer">{TILE_ATTRIBUTION}</a>
        {locatedReports.length === 0 && !loading && <div className="campus-map-empty-overlay"><MapPin size={21}/><strong>{tr(locale, "No reports with a live pin yet", "এতিয়ালৈকে লাইভ পিন থকা প্ৰতিবেদন নাই")}</strong><span>{tr(locale, "Reports appear here when the reporter shares their current location.", "প্ৰতিবেদন দিওঁতাই বৰ্তমানৰ স্থান শ্বেয়াৰ কৰিলে ইয়াত দেখা যাব।")}</span></div>}
      </div>
      <div className="campus-map-report-index"><div className="campus-map-index-heading"><strong>{tr(locale, "Active report list", "সক্ৰিয় প্ৰতিবেদনৰ তালিকা")}</strong><span>{reports.length}</span></div>{loading ? <div className="campus-map-index-empty">{tr(locale, "Loading active reports…", "সক্ৰিয় প্ৰতিবেদন লোড হৈছে…")}</div> : reports.length ? <div className="campus-map-index-list">{reports.map((report) => <button type="button" key={report.id} onClick={() => openReport(report.id)}><span className={`campus-map-priority-dot priority-${priorityClass(report.priority)}`}/><span className="campus-map-index-copy"><strong>{report.ticketNumber} · {reportName(report)}</strong><small>{report.building}{report.area ? ` · ${report.area}` : ""}</small></span>{hasPin(report) ? <span className="campus-map-has-pin"><MapPin size={13}/></span> : <small className="campus-map-no-pin">{tr(locale, "No pin", "পিন নাই")}</small>}</button>)}</div> : <div className="campus-map-index-empty">{tr(locale, "There are no unresolved reports in this view.", "এই দৃশ্যত সমাধান নোহোৱা প্ৰতিবেদন নাই।")}</div>}</div>
    </div>}

    <div className="campus-map-legend" aria-label={tr(locale, "Priority legend", "অগ্ৰাধিকাৰৰ চিহ্ন")}>{(["Urgent", "High", "Medium", "Low"] as Priority[]).map((priority) => <span key={priority}><i className={`campus-map-priority-dot priority-${priorityClass(priority)}`}/>{tr(locale, priority, ({ Urgent: "জৰুৰী", High: "উচ্চ", Medium: "মধ্যম", Low: "কম" } as Record<Priority, string>)[priority])}</span>)}</div>
    <p className="campus-map-privacy"><ShieldCheck size={13}/>{tr(locale, "Only reports that include an optional live location are placed on the map. Reports without a pin remain visible in the list.", "ইচ্ছামূলক লাইভ স্থান দিয়া প্ৰতিবেদনহে মানচিত্ৰত দেখা যায়। পিন নথকা প্ৰতিবেদন তালিকাত থাকিব।")}</p>
  </section>;
}
