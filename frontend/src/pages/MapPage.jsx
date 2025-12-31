import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  Popup,
} from "react-leaflet";
import L from "leaflet";

const API_BASE = "http://localhost:8000";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function MapPage() {
  const center = [51.5074, -0.1278];

  const [mode, setMode] = useState("drive"); // drive | walk
  const [preference, setPreference] = useState("fastest");
  const [route, setRoute] = useState(null);
  const [message, setMessage] = useState("");

  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");

  const [fromPoint, setFromPoint] = useState(null);
  const [toPoint, setToPoint] = useState(null);

  const [fromResults, setFromResults] = useState([]);
  const [toResults, setToResults] = useState([]);

  const [loadingRoute, setLoadingRoute] = useState(false);

  const routeLine = useMemo(() => {
    if (route?.geometry?.length) return route.geometry;
    return null;
  }, [route]);

  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("token"); // or whatever key you saved it as
    navigate("/");
  }

  function onModeChange(nextMode) {
    setMode(nextMode);
    setRoute(null); // clear old route + summary
    setMessage("Mode changed - click Find Route to generate a new route.");

    // Clear message after 3 seconds
    setTimeout(() => {
      setMessage("");
    }, 3000);
  }

  async function onPreferenceChange(nextPreference) {
    setPreference(nextPreference);
    setMessage("");

    // only auto-fetch if a route is already displayed
    if (!route) return;

    await findRoute(nextPreference);
  }

  async function geocode(query, which) {
    setMessage("");
    const res = await fetch(`${API_BASE}/geocode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5 }),
    });

    const data = await res.json();
    if (data.message) setMessage(data.message);

    if (which === "from") setFromResults(data.results || []);
    if (which === "to") setToResults(data.results || []);
  }

  function selectResult(which, item) {
    const point = [item.lat, item.lon];
    setRoute(null); // clear old route when changing endpoints
    setMessage("");

    if (which === "from") {
      setFromPoint(point);
      setFromText(item.display_name);
      setFromResults([]);
    } else {
      setToPoint(point);
      setToText(item.display_name);
      setToResults([]);
    }
  }

  async function findRoute(prefOverride) {
    if (!fromPoint || !toPoint) return;

    const prefToUse = prefOverride || preference;
    const token = localStorage.getItem("token");

    setLoadingRoute(true);
    setMessage("");
    setRoute(null);

    try {
      const res = await fetch(`${API_BASE}/route`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          origin: { lat: fromPoint[0], lon: fromPoint[1] },
          destination: { lat: toPoint[0], lon: toPoint[1] },
          mode,
          preference: prefToUse,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(
          typeof data?.detail === "string" ? data.detail : "Route failed."
        );
      } else {
        setRoute(data);
        setPreference(prefToUse);
      }
    } catch (e) {
      setMessage(String(e));
    } finally {
      setLoadingRoute(false);
    }
  }

  function getRouteExplanation(pref) {
    if (pref === "safest") {
      return "This route avoids most high-risk areas, but a few elevated-risk segments remain.";
    }
    if (pref === "fastest") {
      return "This route prioritizes speed and passes through several high-risk segments.";
    }
    if (pref === "balanced") {
      return "This route balances travel time and safety by avoiding the highest-risk areas where possible.";
    }
    return "";
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "380px 1fr",
        height: "100vh",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 14,
          right: 18,
          zIndex: 1000,
        }}
      >
        <button
          onClick={handleLogout}
          style={{
            background: "#333",
            outline: "none",
            border: "none",
            color: "#fff",
            padding: "7px 12px",
            borderRadius: 10,
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Logout
        </button>
      </div>

      {/* Left panel */}

      <div
        style={{
          padding: 18,
          borderRight: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.18)",
        }}
      >
        <button
          onClick={() => navigate("/")}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.8)",
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 8,
            padding: 0,
          }}
        >
          ← Back to Home
        </button>

        <h2 style={{ margin: "6px 0 12px" }}>Smart Routes</h2>

        {/* Mode buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button
            style={{ ...modeBtn, ...(mode === "drive" ? modeBtnActive : {}) }}
            onClick={() => onModeChange("drive")}
          >
            🚗 Drive
          </button>
          <button
            style={{ ...modeBtn, ...(mode === "walk" ? modeBtnActive : {}) }}
            onClick={() => onModeChange("walk")}
          >
            🚶 Walk
          </button>
        </div>

        <p
          style={{
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.5,
            marginTop: 0,
          }}
        >
          Search places within Greater London, select suggestions, then generate
          a {mode} route.
        </p>

        {message && (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.10)",
              fontSize: 13,
            }}
          >
            {message}
          </div>
        )}

        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {/* FROM */}
          <div style={{ position: "relative" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                From
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={fromText}
                  onChange={(e) => setFromText(e.target.value)}
                  placeholder="e.g., Oxford Circus"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  style={miniBtn}
                  onClick={() => geocode(fromText, "from")}
                  disabled={fromText.trim().length < 2}
                >
                  Search
                </button>
              </div>
            </label>

            {fromResults.length > 0 && (
              <div style={dropdownStyle}>
                {fromResults.map((r, idx) => (
                  <button
                    key={idx}
                    style={dropItem}
                    onClick={() => selectResult("from", r)}
                    title={r.display_name}
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TO */}
          <div style={{ position: "relative" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                To
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={toText}
                  onChange={(e) => setToText(e.target.value)}
                  placeholder="e.g., London Bridge"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  style={miniBtn}
                  onClick={() => geocode(toText, "to")}
                  disabled={toText.trim().length < 2}
                >
                  Search
                </button>
              </div>
            </label>

            {toResults.length > 0 && (
              <div style={dropdownStyle}>
                {toResults.map((r, idx) => (
                  <button
                    key={idx}
                    style={dropItem}
                    onClick={() => selectResult("to", r)}
                    title={r.display_name}
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            style={{
              ...btnStyle,
              opacity: fromPoint && toPoint ? 1 : 0.5,
              cursor: fromPoint && toPoint ? "pointer" : "not-allowed",
            }}
            onClick={() => findRoute()}
            disabled={!fromPoint || !toPoint || loadingRoute}
          >
            {loadingRoute
              ? "Finding route..."
              : `Find ${mode === "drive" ? "Driving" : "Walking"} Route`}
          </button>

          {/* Preference buttons */}
          {route && (
            <div className="route-preference">
              <button
                className={preference === "fastest" ? "active" : ""}
                onClick={() => onPreferenceChange("fastest")}
              >
                Fastest
              </button>

              <button
                className={preference === "safest" ? "active" : ""}
                onClick={() => onPreferenceChange("safest")}
              >
                Safest
              </button>

              <button
                className={preference === "balanced" ? "active" : ""}
                onClick={() => onPreferenceChange("balanced")}
              >
                Balanced
              </button>
            </div>
          )}

          {route && (
            <div style={cardStyle}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                Route summary
              </div>

              {/* Route explanation */}
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  marginBottom: 10,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                {getRouteExplanation(route.preference)}
              </div>

              <div style={statRow}>
                <span style={muted}>Mode</span>
                <span>{route.mode}</span>
              </div>
              <div style={statRow}>
                <span style={muted}>Distance</span>
                <span>{route.distance_km} km</span>
              </div>
              <div style={statRow}>
                <span style={muted}>Est. time</span>
                <span>{route.duration_min} min</span>
              </div>

              <div style={statRow}>
                <span style={muted}>Preference</span>
                <span>{route.preference}</span>
              </div>

              <div style={statRow}>
                <span style={muted}>Safety</span>
                <span>
                  {route.risk_level}-risk (
                  {Math.round((route.avg_risk ?? 0) * 100)}
                  %)
                </span>
              </div>

              <div style={statRow}>
                <span style={muted}>High-risk segments</span>
                <span>{route.high_risk_segments ?? 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{ height: "100%", width: "100%" }}>
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {fromPoint && <Marker position={fromPoint} icon={markerIcon} />}
          {toPoint && <Marker position={toPoint} icon={markerIcon} />}
          {routeLine && <Polyline positions={routeLine} />}
          {route?.risk_markers?.map((m, i) => (
            <CircleMarker
              key={i}
              center={[m.lat, m.lon]}
              radius={6}
              pathOptions={{
                color: "rgb(211, 47, 47)",
                weight: 1,
                fillColor: "rgb(244, 67, 54)",
                fillOpacity: 0.7,
              }}
            >
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 700 }}>High risk zone</div>
                  <div>Risk: {Math.round(m.risk * 100)}%</div>
                  <div>Level: {m.level}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.9)",
  outline: "none",
};

const miniBtn = {
  padding: "12px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.9)",
  fontWeight: 800,
  cursor: "pointer",
};

const btnStyle = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.12)",
  color: "rgba(255,255,255,0.92)",
  fontWeight: 900,
};

const modeBtn = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.9)",
  fontWeight: 900,
  cursor: "pointer",
};

const modeBtnActive = {
  background:
    "linear-gradient(135deg, rgba(124,58,237,1), rgba(34,197,94,0.95))",
  border: "1px solid rgba(255,255,255,0.18)",
};

const dropdownStyle = {
  position: "absolute",
  top: 78,
  left: 0,
  right: 0,
  zIndex: 999,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(10,10,14,0.95)",
  overflow: "hidden",
};

const dropItem = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  border: 0,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "transparent",
  color: "rgba(255,255,255,0.9)",
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1.35,
};

const cardStyle = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
};

const statRow = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 8,
  fontSize: 13,
};
const muted = { color: "rgba(255,255,255,0.72)" };
