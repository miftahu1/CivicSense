"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, LocateFixed, MapPin, Maximize2, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { CAMPUS_LOCATIONS_UPDATED_EVENT, type CampusLocation } from "@/lib/campus-locations";
import { categories, priorities, type Category, type Priority, type ReportStatus } from "@/lib/types";
import { tr } from "@/lib/i18n";

const CAMPUS_CENTER = { latitude: 27.451394583530963, longitude: 94.88989891121943 };
const TILE_SIZE = 256;
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "© OpenStreetMap contributors";
const TILE_ATTRIBUTION_URL = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION_URL || "https://www.openstreetmap.org/copyright";
const SATELLITE_TILE_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTRIBUTION = "Esri, Maxar, Earthstar Geographics, and the GIS User Community";
const SATELLITE_ATTRIBUTION_URL = "https://www.esri.com/en-us/legal/terms/full-master-agreement";
const locationTypes = ["Academic building", "Academic department", "Library", "Event venue", "Workshop", "Food service", "Research facility", "Market", "Gate", "Campus facility"];

type Coordinate = { latitude: number; longitude: number };
type MapLocation = CampusLocation & { issueCount: number };
type LocationSource = "gps" | "building" | "unmapped";
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
  locationSource: LocationSource;
  campusLocationId: string | null;
};
type Tile = { key: string; src: string; left: number; top: number };
type PositionedLocation = { location: MapLocation; x: number; y: number; anchorX: number; anchorY: number };

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
  return { latitude: 180 / Math.PI * Math.atan(Math.sinh(n)), longitude };
}

function getFittedView(points: Coordinate[], width: number, height: number) {
  if (!points.length) return { center: CAMPUS_CENTER, zoom: 15 };
  const projected = points.map((point) => project(point, 0));
  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const maxY = Math.max(...projected.map((point) => point.y));
  const spanX = Math.max(maxX - minX, 0.0005);
  const spanY = Math.max(maxY - minY, 0.0005);
  const availableWidth = Math.max(200, width - 100);
  const availableHeight = Math.max(180, height - 100);
  const fitZoom = Math.floor(Math.min(Math.log2(availableWidth / spanX), Math.log2(availableHeight / spanY)));
  return {
    center: unproject((minX + maxX) / 2, (minY + maxY) / 2, 0),
    zoom: Math.max(5, Math.min(19, fitZoom)),
  };
}

function priorityClass(priority: Priority) {
  return priority.toLowerCase();
}

function hasMapPoint(report: MapReport): report is MapReport & { latitude: number; longitude: number } {
  return typeof report.latitude === "number" && Number.isFinite(report.latitude)
    && typeof report.longitude === "number" && Number.isFinite(report.longitude);
}

function spreadNearbyLocations(locations: MapLocation[], zoom: number, mapLeft: number, mapTop: number): PositionedLocation[] {
  const ungrouped = locations.map((location) => {
    const point = project(location, zoom);
    return { location, x: point.x - mapLeft, y: point.y - mapTop };
  });
  const groups: typeof ungrouped[] = [];
  while (ungrouped.length) {
    const seed = ungrouped.shift()!;
    const group = [seed];
    for (let index = ungrouped.length - 1; index >= 0; index -= 1) {
      const candidate = ungrouped[index];
      if (Math.hypot(candidate.x - seed.x, candidate.y - seed.y) <= 32) group.push(...ungrouped.splice(index, 1));
    }
    groups.push(group);
  }

  return groups.flatMap((group) => {
    if (group.length === 1) return [{ location: group[0].location, x: group[0].x, y: group[0].y, anchorX: group[0].x, anchorY: group[0].y }];
    const centerX = group.reduce((sum, point) => sum + point.x, 0) / group.length;
    const centerY = group.reduce((sum, point) => sum + point.y, 0) / group.length;
    const radius = Math.max(22, group.length * 6);
    return group.map((point, index) => {
      const angle = -Math.PI / 2 + index * 2 * Math.PI / group.length;
      return { location: point.location, x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius, anchorX: point.x, anchorY: point.y };
    });
  });
}

export function CampusIssueMap() {
  const { user, locale, openReport } = useWorkspace();
  const isAdmin = user.role === "admin";
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; centerX: number; centerY: number } | null>(null);
  const mapMovedRef = useRef(false);
  const locationPinPointerRef = useRef<number | null>(null);
  const initialFitRef = useRef(false);
  const [reports, setReports] = useState<MapReport[]>([]);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [unmappedCount, setUnmappedCount] = useState(0);
  const [center, setCenter] = useState<Coordinate>(CAMPUS_CENTER);
  const [zoom, setZoom] = useState(15);
  const [size, setSize] = useState({ width: 720, height: 390 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showCampusLocations, setShowCampusLocations] = useState(true);
  const [showReportedIssues, setShowReportedIssues] = useState(true);
  const [satelliteView, setSatelliteView] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<Priority | "All priorities">("All priorities");
  const [categoryFilter, setCategoryFilter] = useState<Category | "All categories">("All categories");
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [locationFormOpen, setLocationFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<MapLocation | null>(null);
  const [locationName, setLocationName] = useState("");
  const [locationType, setLocationType] = useState("Campus facility");
  const [draftCoordinates, setDraftCoordinates] = useState<Coordinate | null>(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState("");

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workspace/issue-map", { cache: "no-store" });
      const body = await response.json() as { reports?: MapReport[]; locations?: MapLocation[]; unmappedCount?: number; error?: string };
      if (!response.ok) throw new Error(body.error || "Campus reports could not be loaded.");
      setReports(body.reports || []);
      setLocations(body.locations || []);
      setUnmappedCount(body.unmappedCount || 0);
      setSelectedLocation((current) => current ? (body.locations || []).find((location) => location.id === current.id) || null : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Campus reports could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const reportsWithPoints = useMemo(() => reports.filter(hasMapPoint), [reports]);
  const mapFitPoints = useMemo(() => [...locations, ...reportsWithPoints], [locations, reportsWithPoints]);

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

  useEffect(() => {
    if (initialFitRef.current || !mapFitPoints.length) return;
    const view = getFittedView(mapFitPoints, size.width, size.height);
    setCenter(view.center);
    setZoom(view.zoom);
    initialFitRef.current = true;
  }, [mapFitPoints, size.height, size.width]);

  const filteredReports = useMemo(() => reports.filter((report) =>
    (priorityFilter === "All priorities" || report.priority === priorityFilter)
    && (categoryFilter === "All categories" || report.category === categoryFilter),
  ), [categoryFilter, priorityFilter, reports]);
  const markerReports = useMemo(() => filteredReports.filter(hasMapPoint), [filteredReports]);
  const centerPixel = project(center, zoom);
  const mapLeft = centerPixel.x - size.width / 2;
  const mapTop = centerPixel.y - size.height / 2;
  const tileWorldCount = 2 ** zoom;
  const tileUrl = satelliteView ? SATELLITE_TILE_URL : TILE_URL;
  const tileAttribution = satelliteView ? SATELLITE_ATTRIBUTION : TILE_ATTRIBUTION;
  const tileAttributionUrl = satelliteView ? SATELLITE_ATTRIBUTION_URL : TILE_ATTRIBUTION_URL;
  const positionedLocations = useMemo(() => spreadNearbyLocations(locations, zoom, mapLeft, mapTop), [locations, mapLeft, mapTop, zoom]);
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
          src: tileUrl.replaceAll("{z}", String(zoom)).replaceAll("{x}", String(wrappedX)).replaceAll("{y}", String(tileY)),
          left: tileX * TILE_SIZE - mapLeft,
          top: tileY * TILE_SIZE - mapTop,
        });
      }
    }
    return visible;
  }, [mapLeft, mapTop, size.height, size.width, tileUrl, tileWorldCount, zoom]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a, input, select, label")) return;
    const pixel = project(center, zoom);
    mapMovedRef.current = false;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, centerX: pixel.x, centerY: pixel.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 4) mapMovedRef.current = true;
    setCenter(unproject(drag.centerX - (event.clientX - drag.x), drag.centerY - (event.clientY - drag.y), zoom));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function changeZoom(nextZoom: number) {
    setZoom(Math.max(5, Math.min(19, nextZoom)));
  }

  function fitMap(points: Coordinate[]) {
    const view = getFittedView(points, size.width, size.height);
    setCenter(view.center);
    setZoom(view.zoom);
  }

  function fitReports() {
    fitMap(reportsWithPoints.length ? reportsWithPoints : locations);
  }

  function handleMapClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!isAdmin || !locationFormOpen) return;
    if (mapMovedRef.current) { mapMovedRef.current = false; return; }
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraftCoordinates(unproject(mapLeft + event.clientX - rect.left, mapTop + event.clientY - rect.top, zoom));
  }

  function coordinateAtClientPosition(clientX: number, clientY: number) {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return unproject(mapLeft + clientX - rect.left, mapTop + clientY - rect.top, zoom);
  }

  function openLocationEditor(location?: MapLocation) {
    setEditingLocation(location || null);
    setLocationName(location?.name || "");
    setLocationType(location?.locationType || "Campus facility");
    setDraftCoordinates(location ? { latitude: location.latitude, longitude: location.longitude } : null);
    setLocationError("");
    setLocationFormOpen(true);
  }

  function closeLocationEditor() {
    setLocationFormOpen(false);
    setEditingLocation(null);
    setLocationError("");
  }

  async function saveLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocationError("");
    if (!draftCoordinates) { setLocationError(tr(locale, "Click the map or drag the pin to choose coordinates.", "স্থানাঙ্ক বাছিবলৈ মানচিত্ৰত টিপক অথবা পিন টানি আনক।")); return; }
    if (!locationName.trim()) { setLocationError(tr(locale, "Enter a building or facility name.", "ভৱন বা সুবিধাৰ নাম দিয়ক।")); return; }
    setLocationSaving(true);
    try {
      const response = await fetch("/api/workspace/campus-locations", {
        method: editingLocation ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingLocation ? { id: editingLocation.id } : {}),
          name: locationName.trim(),
          locationType: locationType.trim(),
          latitude: draftCoordinates.latitude,
          longitude: draftCoordinates.longitude,
        }),
      });
      const body = await response.json() as { location?: MapLocation; error?: string };
      if (!response.ok || !body.location) throw new Error(body.error || "The campus location could not be saved.");
      window.dispatchEvent(new Event(CAMPUS_LOCATIONS_UPDATED_EVENT));
      await refresh(true);
      setSelectedLocation({ ...body.location, issueCount: editingLocation?.issueCount || 0 });
      closeLocationEditor();
    } catch (caught) {
      setLocationError(caught instanceof Error ? caught.message : "The campus location could not be saved.");
    } finally {
      setLocationSaving(false);
    }
  }

  async function removeLocation(location: MapLocation) {
    const confirmed = window.confirm(tr(
      locale,
      `Remove “${location.name}” from the campus registry? Reports without GPS that use this building will remain in the report list but lose their map pin until the location is registered again.`,
      `“${location.name}” কেম্পাছ পঞ্জীয়নৰ পৰা আঁতৰাবনে? GPS নথকা এই ভৱনৰ প্ৰতিবেদন তালিকাত থাকিব, কিন্তু স্থান পুনৰ পঞ্জীয়ন নকৰালৈকে মানচিত্ৰৰ পিন নাথাকিব।`,
    ));
    if (!confirmed) return;
    setLocationError("");
    try {
      const response = await fetch("/api/workspace/campus-locations", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: location.id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "The campus location could not be removed.");
      setSelectedLocation(null);
      window.dispatchEvent(new Event(CAMPUS_LOCATIONS_UPDATED_EVENT));
      await refresh(true);
    } catch (caught) {
      setLocationError(caught instanceof Error ? caught.message : "The campus location could not be removed.");
    }
  }

  function reportName(report: MapReport) {
    return locale === "as" ? report.titleAs || report.titleEn || report.ticketNumber : report.titleEn || report.titleAs || report.ticketNumber;
  }

  return <section className="panel campus-map-panel">
    <div className="campus-map-heading">
      <div><div className="section-kicker">{tr(locale, "Campus issue map", "কেম্পাছৰ সমস্যা মানচিত্ৰ")}</div><h2>{tr(locale, "Campus locations and active issues", "কেম্পাছৰ স্থান আৰু সক্ৰিয় সমস্যা")}</h2><p>{user.role === "admin" ? tr(locale, "Registered places and unresolved reports across campus.", "পঞ্জীয়ন কৰা স্থান আৰু কেম্পাছৰ সমাধান নোহোৱা প্ৰতিবেদন।") : tr(locale, "Registered places and unresolved reports assigned to your department.", "পঞ্জীয়ন কৰা স্থান আৰু আপোনাৰ বিভাগক দিয়া সমাধান নোহোৱা প্ৰতিবেদন।")}</p></div>
      <div className="campus-map-heading-actions">{isAdmin && <button type="button" className="button button-outline button-small" onClick={() => openLocationEditor()}><Plus size={14}/>{tr(locale, "Add location", "স্থান যোগ কৰক")}</button>}<button type="button" className="button button-outline button-small" onClick={() => void refresh(true)} disabled={loading || refreshing}><RefreshCw size={13} className={refreshing ? "spin-icon" : ""}/>{tr(locale, "Refresh", "পুনৰ লোড")}</button></div>
    </div>

    {locationFormOpen && isAdmin && <form className="campus-location-editor" onSubmit={saveLocation}>
      <div className="campus-location-editor-heading"><div><strong>{editingLocation ? tr(locale, "Edit campus location", "কেম্পাছৰ স্থান সম্পাদনা কৰক") : tr(locale, "Register a campus location", "কেম্পাছৰ স্থান পঞ্জীয়ন কৰক")}</strong><span>{tr(locale, "Click the map to place the pin. Drag it to adjust.", "পিন স্থাপন কৰিবলৈ মানচিত্ৰত টিপক। স্থান সলাবলৈ পিন টানি আনক।")}</span></div><button type="button" className="button button-outline button-small" onClick={closeLocationEditor}>{tr(locale, "Cancel", "বাতিল")}</button></div>
      <div className="campus-location-editor-fields"><label>{tr(locale, "Building or facility name", "ভৱন বা সুবিধাৰ নাম")}<input value={locationName} onChange={(event) => setLocationName(event.target.value)} maxLength={100} placeholder={tr(locale, "e.g. Student Health Centre", "যেনে: ছাত্ৰ স্বাস্থ্য কেন্দ্ৰ")} required/></label><label>{tr(locale, "Location type", "স্থানৰ ধৰণ")}<input value={locationType} onChange={(event) => setLocationType(event.target.value)} list="campus-location-types" maxLength={60} required/><datalist id="campus-location-types">{locationTypes.map((type) => <option key={type} value={type}/>)}</datalist></label>
        <div className="campus-location-coordinates"><span>{tr(locale, "Selected coordinates", "বাছনি কৰা স্থানাংক")}</span><strong>{draftCoordinates ? `${draftCoordinates.latitude.toFixed(6)}, ${draftCoordinates.longitude.toFixed(6)}` : tr(locale, "Not selected yet", "এতিয়াও বাছনি কৰা হোৱা নাই")}</strong></div><button type="submit" className="button button-terracotta" disabled={locationSaving}>{locationSaving ? tr(locale, "Saving…", "সংৰক্ষণ হৈছে…") : editingLocation ? tr(locale, "Save changes", "সলনি সংৰক্ষণ কৰক") : tr(locale, "Add to campus map", "কেম্পাছ মানচিত্ৰত যোগ কৰক")}</button></div>
      {locationError && <p className="campus-location-error" role="alert">{locationError}</p>}
    </form>}

    <div className="campus-map-summary"><span><strong>{locations.length}</strong>{tr(locale, " registered locations", "টা পঞ্জীয়ন কৰা স্থান")}</span><span><strong>{reports.length}</strong>{tr(locale, " unresolved reports", "টা সমাধান নোহোৱা প্ৰতিবেদন")}</span><span><strong>{reportsWithPoints.length}</strong>{tr(locale, " mapped reports", "টা মানচিত্ৰত দেখুওৱা প্ৰতিবেদন")}</span>{unmappedCount > 0 && <span className="campus-map-unpinned"><ShieldCheck size={13}/>{unmappedCount} {tr(locale, "unmapped · still listed", "টা স্থান মিলা নাই · তালিকাত আছে")}</span>}</div>

    <div className="campus-map-tools">
      <div className="campus-map-layers"><strong>{tr(locale, "Map layers", "মানচিত্ৰৰ স্তৰ")}</strong><label><input type="checkbox" checked={showCampusLocations} onChange={(event) => setShowCampusLocations(event.target.checked)}/>{tr(locale, "Campus locations", "কেম্পাছৰ স্থান")} <span>{locations.length}</span></label><label><input type="checkbox" checked={showReportedIssues} onChange={(event) => setShowReportedIssues(event.target.checked)}/>{tr(locale, "Reported issues", "জনোৱা সমস্যা")} <span>{filteredReports.length}</span></label><label className="map-satellite-toggle"><span>{tr(locale, "Streets", "ৰাস্তা")}</span><input type="checkbox" role="switch" aria-label={tr(locale, "Satellite view", "উপগ্ৰহ দৃশ্য")} checked={satelliteView} onChange={(event) => setSatelliteView(event.target.checked)}/><span>{tr(locale, "Satellite", "উপগ্ৰহ")}</span></label></div>
      <div className="campus-map-filters"><label>{tr(locale, "Priority", "অগ্ৰাধিকাৰ")}<select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as Priority | "All priorities")}><option>All priorities</option>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label><label>{tr(locale, "Category", "শ্ৰেণী")}<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as Category | "All categories")}><option>All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div>
    </div>

    {error ? <div className="campus-map-error" role="alert"><MapPin size={18}/><p>{error}</p><button type="button" className="button button-outline button-small" onClick={() => void refresh(true)}>{tr(locale, "Try again", "পুনৰ চেষ্টা কৰক")}</button></div> : <div className="campus-map-layout">
      <div className={`campus-map-frame ${locationFormOpen && isAdmin ? "campus-map-placement-mode" : ""}`} ref={mapRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onClick={handleMapClick} onWheel={(event) => { if (event.deltaY) changeZoom(zoom + (event.deltaY < 0 ? 1 : -1)); }} style={{ touchAction: "none" }} aria-label={tr(locale, "Interactive map of campus facilities and unresolved campus reports", "কেম্পাছৰ সুবিধা আৰু সমাধান নোহোৱা প্ৰতিবেদনৰ ইণ্টাৰেক্টিভ মানচিত্ৰ")}>
        <div className="campus-map-tiles">{tiles.map((tile) => <div key={tile.key} className="campus-map-tile" style={{ left: tile.left, top: tile.top, backgroundImage: `url("${tile.src}")` }}/>)}</div>
        <div className="campus-map-markers">
          {showCampusLocations && positionedLocations.map(({ location, x, y, anchorX, anchorY }) => {
            if (x < -30 || y < -30 || x > size.width + 30 || y > size.height + 30) return null;
            const dx = x - anchorX;
            const dy = y - anchorY;
            const leaderLength = Math.hypot(dx, dy);
            return <span key={location.id} className="campus-map-location-position"><span className="campus-map-location-leader" aria-hidden="true" style={{ left: anchorX, top: anchorY, width: leaderLength, transform: `rotate(${Math.atan2(dy, dx)}rad)` }}/><button type="button" className={`campus-map-location-marker ${selectedLocation?.id === location.id ? "selected" : ""}`} style={{ left: x, top: y }} title={`${location.name} · ${location.locationType} · ${location.issueCount} unresolved reports`} aria-label={`${location.name}, ${location.locationType}, ${location.issueCount} unresolved reports`} onClick={(event) => { event.stopPropagation(); setSelectedLocation(location); }}><Building2 size={17}/></button></span>;
          })}
          {showReportedIssues && markerReports.map((report, index) => {
            if (!hasMapPoint(report)) return null;
            const point = project(report, zoom);
            const collisionIndex = markerReports.slice(0, index).filter((prior) => hasMapPoint(prior) && prior.latitude === report.latitude && prior.longitude === report.longitude).length;
            const angle = collisionIndex * 2.4;
            const radius = collisionIndex ? 15 + Math.floor(collisionIndex / 8) * 5 : 0;
            const x = point.x - mapLeft + Math.cos(angle) * radius;
            const y = point.y - mapTop + Math.sin(angle) * radius;
            if (x < -30 || y < -40 || x > size.width + 30 || y > size.height + 40) return null;
            const label = report.locationSource === "gps" ? "Precise GPS location" : "Approximate building location";
            return <button key={report.id} type="button" className={`campus-map-marker priority-${priorityClass(report.priority)} ${report.locationSource === "building" ? "approximate" : "precise"}`} style={{ left: x, top: y }} title={`${report.ticketNumber} · ${reportName(report)} · ${report.priority} · ${label}`} aria-label={`${report.ticketNumber}, ${reportName(report)}, ${report.priority}, ${label}. Open report.`} onClick={(event) => { event.stopPropagation(); openReport(report.id); }}>{report.locationSource === "building" ? <Building2 size={22}/> : <MapPin size={30} fill="currentColor" stroke="white" strokeWidth={1.8}/>}<span>{report.priority === "Urgent" ? "!" : report.priority === "High" ? "↑" : report.priority === "Medium" ? "•" : "·"}</span></button>;
          })}
          {isAdmin && locationFormOpen && draftCoordinates && (() => {
            const point = project(draftCoordinates, zoom);
            const x = point.x - mapLeft;
            const y = point.y - mapTop;
            return <button type="button" className="campus-map-draft-marker" style={{ left: x, top: y }} title={tr(locale, "Drag to adjust selected location", "বাছনি কৰা স্থান সলাবলৈ পিন টানি আনক")} aria-label={tr(locale, "Drag to adjust selected location", "বাছনি কৰা স্থান সলাবলৈ পিন টানি আনক")} onPointerDown={(event) => { event.stopPropagation(); locationPinPointerRef.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { event.stopPropagation(); if (locationPinPointerRef.current === event.pointerId) { const coordinate = coordinateAtClientPosition(event.clientX, event.clientY); if (coordinate) setDraftCoordinates(coordinate); } }} onPointerUp={(event) => { event.stopPropagation(); if (locationPinPointerRef.current === event.pointerId) locationPinPointerRef.current = null; }} onPointerCancel={(event) => { event.stopPropagation(); locationPinPointerRef.current = null; }} onClick={(event) => event.stopPropagation()}><MapPin size={35} fill="currentColor"/></button>;
          })()}
        </div>
        {selectedLocation && <div className="campus-location-popup" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <div className="campus-location-popup-head"><span className="campus-location-popup-icon"><Building2 size={16}/></span><div><strong>{selectedLocation.name}</strong><small>{selectedLocation.locationType}</small></div><button type="button" aria-label={tr(locale, "Close location details", "স্থানৰ বিৱৰণ বন্ধ কৰক")} onClick={() => setSelectedLocation(null)}>×</button></div>
          <div className="campus-location-popup-count"><strong>{selectedLocation.issueCount}</strong><span>{tr(locale, "unresolved reports associated with this location", "টা সমাধান নোহোৱা প্ৰতিবেদন এই স্থানৰ সৈতে জড়িত")}</span></div>
          <a href={`https://www.google.com/maps/search/?api=1&query=${selectedLocation.latitude},${selectedLocation.longitude}`} target="_blank" rel="noreferrer">{tr(locale, "Open in Google Maps", "Google Maps-ত খোলক")} <span>↗</span></a>
          {isAdmin && <div className="campus-location-popup-actions"><button type="button" onClick={() => openLocationEditor(selectedLocation)}><Pencil size={13}/>{tr(locale, "Edit", "সম্পাদনা")}</button><button type="button" onClick={() => void removeLocation(selectedLocation)}><Trash2 size={13}/>{tr(locale, "Remove", "আঁতৰাওক")}</button></div>}
        </div>}
        <div className="campus-map-controls" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><button type="button" aria-label={tr(locale, "Zoom in", "ওচৰলৈ আনক")} onClick={() => changeZoom(zoom + 1)}><ZoomIn size={16}/></button><button type="button" aria-label={tr(locale, "Zoom out", "দূৰলৈ নিনক")} onClick={() => changeZoom(zoom - 1)}><ZoomOut size={16}/></button><button type="button" aria-label={tr(locale, "Fit issue locations", "সমস্যাৰ স্থানসমূহ দেখুৱাওক")} onClick={fitReports}><Maximize2 size={15}/></button><button type="button" aria-label={tr(locale, "Return to campus", "কেম্পাছলৈ উভতি যাওক")} onClick={() => fitMap(locations.length ? locations : [CAMPUS_CENTER])}><LocateFixed size={15}/></button></div>
        {locationFormOpen && isAdmin && <div className="campus-map-placement-hint" onPointerDown={(event) => event.stopPropagation()}>{tr(locale, "Click anywhere on the map to place the location pin", "স্থানৰ পিন ৰাখিবলৈ মানচিত্ৰৰ যিকোনো ঠাইত টিপক")}</div>}
        <a className="campus-map-attribution" href={tileAttributionUrl} target="_blank" rel="noreferrer">{tileAttribution}</a>
        {!loading && locations.length === 0 && reportsWithPoints.length === 0 && <div className="campus-map-empty-overlay"><MapPin size={21}/><strong>{tr(locale, "No locations to show yet", "দেখুৱাবলৈ এতিয়াও স্থান নাই")}</strong><span>{tr(locale, "Registered campus locations and reports with mappable locations will appear here.", "পঞ্জীয়ন কৰা কেম্পাছৰ স্থান আৰু স্থান মেপ কৰিব পৰা প্ৰতিবেদন ইয়াত দেখা যাব।")}</span></div>}
      </div>
      <div className="campus-map-report-index"><div className="campus-map-index-heading"><strong>{tr(locale, "Unresolved report list", "সমাধান নোহোৱা প্ৰতিবেদনৰ তালিকা")}</strong><span>{filteredReports.length} / {reports.length}</span></div>{loading ? <div className="campus-map-index-empty">{tr(locale, "Loading campus reports…", "কেম্পাছৰ প্ৰতিবেদন লোড হৈছে…")}</div> : filteredReports.length ? <div className="campus-map-index-list">{filteredReports.map((report) => <button type="button" key={report.id} onClick={() => openReport(report.id)}><span className={`campus-map-priority-dot priority-${priorityClass(report.priority)}`}/><span className="campus-map-index-copy"><strong>{report.ticketNumber} · {reportName(report)}</strong><small>{report.building}{report.area ? ` · ${report.area}` : ""}</small></span>{report.locationSource === "gps" ? <MapPin className="campus-map-precision-icon" size={14} aria-label={tr(locale, "Precise GPS", "নিখুঁত GPS")}/> : report.locationSource === "building" ? <Building2 className="campus-map-approx-icon" size={14} aria-label={tr(locale, "Approximate building location", "আনুমানিক ভৱনৰ স্থান")}/> : <small className="campus-map-no-pin">{tr(locale, "Not mapped", "স্থান মিলা নাই")}</small>}</button>)}</div> : <div className="campus-map-index-empty">{tr(locale, "No reports match these filters.", "এই ফিল্টাৰৰ সৈতে মিল থকা প্ৰতিবেদন নাই।")}</div>}</div>
    </div>}

    {locationError && !locationFormOpen && <p className="campus-location-error" role="alert">{locationError}</p>}
    <div className="campus-map-legend" aria-label={tr(locale, "Priority colors", "অগ্ৰাধিকাৰৰ ৰং")}><strong>{tr(locale, "Priority", "অগ্ৰাধিকাৰ")}</strong>{priorities.map((priority) => <span key={priority}><i className={`campus-map-priority-dot priority-${priorityClass(priority)}`}/>{priority}</span>)}</div>
  </section>;
}
