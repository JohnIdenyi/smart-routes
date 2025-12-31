from shapely.geometry import Point as ShapelyPoint
from osmnx.projection import project_geometry
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pyproj import Transformer

import requests
import os

import osmnx as ox
import networkx as nx
import pandas as pd

from app.database import Base, engine
from app.auth.router import router as auth_router
from app.auth.deps import get_current_user

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RISK_PATH = os.path.join(BASE_DIR, "data", "risk_layer_latest_month.csv")
risk_df = pd.read_csv(RISK_PATH)

risk_lookup = {}
for r in risk_df.itertuples(index=False):
    u, v, k = int(r.u), int(r.v), int(r.k)
    val = float(r.risk_proba)
    risk_lookup[(u, v, k)] = val
    risk_lookup[(v, u, k)] = val  # reverse direction
print("Loaded risk entries:", len(risk_lookup))

app = FastAPI(
    title="Smart Safe Routes API",
    version="0.2.0",
    description="Python-only backend for risk-aware routing in Greater London."
)

Base.metadata.create_all(bind=engine)
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Approx Greater London bounding box (fast coverage check)
LONDON_BBOX = {
    "min_lat": 51.2868,
    "max_lat": 51.6919,
    "min_lon": -0.5103,
    "max_lon": 0.3340
}

def in_greater_london(lat: float, lon: float) -> bool:
    return (
        LONDON_BBOX["min_lat"] <= lat <= LONDON_BBOX["max_lat"] and
        LONDON_BBOX["min_lon"] <= lon <= LONDON_BBOX["max_lon"]
    )

#### Major changes #####
# --------- OSM Graphs (Drive + Walk) ----------
# ---------- OSM Graphs (Drive + Walk) with caching ----------

PLACE = "Greater London, United Kingdom"

BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # backend/
CACHE_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(CACHE_DIR, exist_ok=True)

DRIVE_PATH = os.path.join(CACHE_DIR, "greater_london_drive_projected.graphml")
WALK_PATH  = os.path.join(CACHE_DIR, "greater_london_walk_projected.graphml")

def load_or_build_graph(path: str, network_type: str):
    if os.path.exists(path):
        print(f"✅ Loading cached graph: {path}")
        return ox.load_graphml(path)

    print(f"⬇️ Downloading {network_type} graph from OSM (first run only)...")
    G = ox.graph_from_place(PLACE, network_type=network_type, simplify=True)

    print("📐 Projecting graph...")
    G = ox.project_graph(G)

    print(f"💾 Saving graph cache to: {path}")
    ox.save_graphml(G, path)
    return G

print("Loading OSM graphs (Drive + Walk)...")
G_DRIVE = load_or_build_graph(DRIVE_PATH, "drive")
G_WALK  = load_or_build_graph(WALK_PATH, "walk")

print("Drive graph:", len(G_DRIVE.nodes), "nodes,", len(G_DRIVE.edges), "edges")
print("Walk graph:", len(G_WALK.nodes), "nodes,", len(G_WALK.edges), "edges")

### End major changes ###

print("Drive graph:", len(G_DRIVE.nodes), "nodes,", len(G_DRIVE.edges), "edges")
print("Walk graph:", len(G_WALK.nodes), "nodes,", len(G_WALK.edges), "edges")

# Quick sanity check: confirm 'length' exists on at least one edge
u, v, k, data = next(iter(G_DRIVE.edges(keys=True, data=True)))
print("Sample drive edge keys:", list(data.keys()))

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": False,
        "graph_loaded": True,
        "drive_nodes": len(G_DRIVE.nodes),
        "walk_nodes": len(G_WALK.nodes),
    }

# --------- Geocoding ----------
class GeocodeRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=120)
    limit: int = Field(5, ge=1, le=10)

@app.post("/geocode")
def geocode(req: GeocodeRequest):
    q = req.query.strip()
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": q, "format": "json", "addressdetails": 1, "limit": req.limit}
    headers = {"User-Agent": "SmartSafeRoutesMSc/1.0 (demo project)"}

    try:
        r = requests.get(url, params=params, headers=headers, timeout=12)
        r.raise_for_status()
        results = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Geocoding failed: {e}")

    filtered = []
    for item in results:
        try:
            lat = float(item["lat"])
            lon = float(item["lon"])
        except Exception:
            continue

        if not in_greater_london(lat, lon):
            continue

        filtered.append({
            "display_name": item.get("display_name", q),
            "lat": lat,
            "lon": lon
        })

    if not filtered:
        return {
            "results": [],
            "message": "Location not available. This application currently supports routes within Greater London only."
        }

    return {"results": filtered}

# --------- Routing ----------
class GeoPoint(BaseModel):
    lat: float
    lon: float

class RouteRequest(BaseModel):
    origin: GeoPoint
    destination: GeoPoint
    mode: str = Field(..., pattern="^(drive|walk)$")
    preference: str = Field("fastest", pattern="^(fastest|balanced|safest)$")

def edge_cost(u, v, k, data, preference):
    length = data.get("length", 1.0)
    risk = risk_lookup.get((u, v, k), 0.0)

    if preference == "fastest":
        return length
    if preference == "balanced":
        return length * (1 + 1.0 * risk)
    if preference == "safest":
        return length * (1 + 4.0 * risk)
    return length

def risk_level(r: float) -> str:
    if r >= 0.6:
        return "high"
    if r >= 0.3:
        return "medium"
    return "low"

@app.post("/route")
def route(req: RouteRequest, user=Depends(get_current_user)):
    o_lat, o_lon = req.origin.lat, req.origin.lon
    d_lat, d_lon = req.destination.lat, req.destination.lon

    if not in_greater_london(o_lat, o_lon) or not in_greater_london(d_lat, d_lon):
        raise HTTPException(status_code=400, detail="OUT_OF_COVERAGE: Greater London only.")

    G = G_DRIVE if req.mode == "drive" else G_WALK

    # Convert input lon/lat -> graph CRS (projected)
    o_geom, _ = project_geometry(ShapelyPoint(o_lon, o_lat), to_crs=G.graph["crs"])
    d_geom, _ = project_geometry(ShapelyPoint(d_lon, d_lat), to_crs=G.graph["crs"])


    orig_node = ox.distance.nearest_nodes(G, o_geom.x, o_geom.y)
    dest_node = ox.distance.nearest_nodes(G, d_geom.x, d_geom.y)


    # Phase 1: shortest by length
    def cost_func(u, v, data, k=None):
        if isinstance(data, dict) and 0 in data:
            best = float("inf")
            for kk, dd in data.items():
                c = edge_cost(u, v, kk, dd, req.preference)
                if c < best:
                    best = c
            return best

        kk = k if k is not None else 0
        return edge_cost(u, v, kk, data, req.preference)


    try:
        path_nodes = ox.routing.shortest_path(
        G,
        orig_node,
        dest_node,
        weight=cost_func
    )

    except nx.NetworkXNoPath:
        raise HTTPException(status_code=404, detail="No route found between the two points.")

    # Build polyline (projected -> lat/lon for Leaflet)
    transformer = Transformer.from_crs(G.graph["crs"], "EPSG:4326", always_xy=True)

    # --- Risk summary + high-risk markers (no polyline recolor needed) ---
    RISK_MARKER_THRESHOLD = 0.6  # tweak if you want more/less markers
    MARKER_EVERY_N = 3           # reduce spam: keep 1 marker per ~3 risky edges

    segment_risks = []
    risk_markers = []
    risk_sum = 0.0
    risk_count = 0
    high_count = 0

    # iterate edges along the path
    for idx, (u, v) in enumerate(zip(path_nodes[:-1], path_nodes[1:])):
        edges = G.get_edge_data(u, v) or {}
        if not edges:
            continue

        # choose the same edge key idea as your routing: take minimum cost edge
        best_k = None
        best_cost = float("inf")
        best_risk = 0.0
        best_len = 0.0
        for k, data in edges.items():
            length = float(data.get("length", 0.0))
            r = float(risk_lookup.get((u, v, k), 0.0))
            c = edge_cost(u, v, k, data, req.preference)
            if c < best_cost:
                best_cost = c
                best_k = k
                best_risk = r
                best_len = length

        # store segment info (optional but useful for debugging/UI later)
        segment_risks.append({
            "u": int(u), "v": int(v), "k": int(best_k if best_k is not None else 0),
            "risk": float(best_risk),
            "length_m": float(best_len),
        })

        # risk aggregates
        risk_sum += best_risk
        risk_count += 1
        if best_risk >= RISK_MARKER_THRESHOLD:
            high_count += 1

            # add a marker sometimes (to avoid too many)
            if (high_count % MARKER_EVERY_N) == 1:
                # midpoint between nodes u and v (in projected x/y -> lat/lon)
                x1, y1 = G.nodes[u]["x"], G.nodes[u]["y"]
                x2, y2 = G.nodes[v]["x"], G.nodes[v]["y"]
                mx, my = (x1 + x2) / 2.0, (y1 + y2) / 2.0
                lon, lat = transformer.transform(mx, my)

                risk_markers.append({
                    "lat": lat,
                    "lon": lon,
                    "risk": float(best_risk),
                    "level": risk_level(best_risk),
                })

    avg_risk = (risk_sum / risk_count) if risk_count else 0.0


    geometry = []
    for n in path_nodes:
        x = G.nodes[n]["x"]
        y = G.nodes[n]["y"]
        lon, lat = transformer.transform(x, y)
        geometry.append([lat, lon])  # Leaflet expects [lat, lon]


    # Distance (meters)
    dist_m = 0.0
    for u, v in zip(path_nodes[:-1], path_nodes[1:]):
        edges = G.get_edge_data(u, v)
        if edges:
            dist_m += min(ed.get("length", 0.0) for ed in edges.values())

    dist_km = dist_m / 1000.0

    # Simple speed estimate (demo)
    avg_speed_kmh = 25.0 if req.mode == "drive" else 4.8
    duration_min = (dist_km / avg_speed_kmh) * 60.0

    return {
        "mode": req.mode,
        "preference": req.preference,
        "distance_km": round(dist_km, 3),
        "duration_min": round(duration_min, 1),

        "avg_risk": round(avg_risk, 3),
        "risk_level": risk_level(avg_risk),
        "high_risk_segments": int(high_count),

        "geometry": geometry,
        "risk_markers": risk_markers,
    }

