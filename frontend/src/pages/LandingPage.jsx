import React from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/landing.css";

export default function LandingPage() {
  const nav = useNavigate();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="logo" aria-hidden="true" />
          <div>
            <h1>Smart Safe Routes</h1>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
              Safer routing across Greater London
            </div>
          </div>
        </div>
        <div className="tag">
          <Link to="/signup">Sign up</Link>
        </div>
      </header>

      <main className="hero">
        <section className="heroLeft">
          <h2 className="headline">
            Find routes that don't just get you there
            <br />
            they help you feel safer.
          </h2>

          <p className="sub">
            Smart Safe Routes uses crime-pattern insights to estimate road risk
            and suggest safer paths across Greater London. Compare{" "}
            <b>Fastest</b>, <b>Balanced</b>, and <b>Safest</b> options before
            you move.
          </p>

          <div className="pillRow">
            <span className="pill">
              <span className="dot" /> Risk-aware routing
            </span>
            <span className="pill">
              <span
                className="dot"
                style={{
                  background: "var(--accent2)",
                  boxShadow: "0 0 0 4px rgba(34,197,94,0.16)",
                }}
              />
              Greater London coverage
            </span>
            <span className="pill">
              <span
                className="dot"
                style={{
                  background: "var(--danger)",
                  boxShadow: "0 0 0 4px rgba(239,68,68,0.14)",
                }}
              />
              Severity-weighted crime signals
            </span>
          </div>

          <div className="actions">
            <button className="btn btnPrimary" onClick={() => nav("/map")}>
              <Link to="/login">Log in</Link> <span aria-hidden="true">→</span>
            </button>

            <button
              className="btn btnGhost"
              onClick={() =>
                document
                  .getElementById("how")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              How it works
            </button>
          </div>

          <div className="note">
            <span className="noteBadge">Coverage</span>
            Searches and routes are supported within Greater London only.
          </div>
        </section>

        <aside className="heroRight">
          <div className="panelHead">
            <p className="panelTitle">What you get</p>
            {/* <span className="badge">Demo-ready</span> */}
          </div>

          <div className="panelBody">
            <div className="card">
              <h3>Safer suggestions</h3>
              <p>
                We score road segments using historical crime patterns and
                produce routes that avoid higher-risk areas where practical.
              </p>
            </div>

            <div className="card">
              <h3>Transparent trade-offs</h3>
              <p>
                View distance, time, and average risk side-by-side so you can
                pick what matters most.
              </p>
            </div>

            <div className="card" id="how">
              <h3>Built for Greater London</h3>
              <p>
                The model and road graph are limited to Greater London coverage
                to avoid misleading results.
              </p>
            </div>
          </div>
        </aside>
      </main>

      <footer className="footer">
        <div>© {new Date().getFullYear()} Smart Safe Routes • MSc Project</div>
        <div className="links">
          <a
            className="link"
            href="https://www.openstreetmap.org/"
            target="_blank"
            rel="noreferrer"
          >
            Map data: OSM
          </a>
          <a
            className="link"
            href="https://data.police.uk/"
            target="_blank"
            rel="noreferrer"
          >
            Crime data: UK Police
          </a>
        </div>
      </footer>
    </div>
  );
}
