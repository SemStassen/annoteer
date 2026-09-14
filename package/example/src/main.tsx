import React from "react";
import { createRoot } from "react-dom/client";
import { Annoteer } from "annoteer";
import "./style.css";

function App() {
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState("");
  const start = async (role: string) => {
    setStarting(true);
    setError("");
    try {
      const response = await fetch("/__annoteer_demo");
      if (!response.ok)
        throw new Error("Start the local demo with pnpm dev to create review links.");
      const links = (await response.json()) as Record<string, string>;
      location.href = links[role];
      location.reload();
    } catch (cause) {
      setError((cause as Error).message);
      setStarting(false);
    }
  };
  return (
    <>
      <div className="demo-strip" data-annoteer-ignore>
        <span>
          <span className="live" /> ANNOTEER PLAYGROUND
        </span>
        <span>A real website. A fresh perspective.</span>
        <div>
          <button disabled={starting} onClick={() => void start("client")}>
            Review as client ↗
          </button>
          <button disabled={starting} onClick={() => void start("agency")}>
            Review as agency ↗
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="demo-error">
          {error}
        </p>
      )}
      <header className="nav">
        <a className="wordmark" href="/">
          fieldwork<span>®</span>
        </a>
        <nav>
          <a href="#work">Selected work</a>
          <a href="#approach">Our approach</a>
          <a className="contact" href="mailto:hello@example.com">
            Let’s talk <span>↗</span>
          </a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="eyebrow">
            <span className="tiny-star">✳</span> INDEPENDENT DESIGN STUDIO · EST. 2024
          </div>
          <h1 data-annoteer-id="hero-title">
            Good things
            <br />
            start with a<br />
            <em>different</em> perspective<span className="period">.</span>
          </h1>
          <div className="hero-bottom">
            <p data-annoteer-id="hero-description">
              We turn thoughtful ideas into brands and digital
              <br className="desktop" /> experiences that feel a little more human.
            </p>
            <a className="round-link" href="#work">
              <span>Explore our work</span>
              <span className="circle">↓</span>
            </a>
          </div>
          <div className="hero-art" aria-label="Sculptural abstract green composition">
            <div className="orb one" />
            <div className="orb two" />
            <div className="orb three" />
            <div className="art-caption">
              A NEW POINT OF VIEW
              <br />
              <span>FIG. 001 — FIELD NOTES</span>
            </div>
            <span className="art-plus">+</span>
          </div>
        </section>
        <section className="work" id="work">
          <div className="section-heading">
            <h2>
              A few things
              <br />
              we’ve put into the world.
            </h2>
            <span>SELECTED WORK / 01—02</span>
          </div>
          <div className="projects">
            <article>
              <div className="project-image olive">
                <span className="project-type">EVERYDAY, REIMAGINED.</span>
                <div className="project-word">
                  morrow<span>↗</span>
                </div>
                <span className="project-tag">GOOD FOR YOU. BETTER FOR TOMORROW.</span>
              </div>
              <div className="project-label">
                <h3>Morrow</h3>
                <span>Strategy · Identity · Digital</span>
                <span>↗</span>
              </div>
            </article>
            <article>
              <div className="project-image peach">
                <span className="project-type">A PLACE TO SLOW DOWN.</span>
                <div className="hotel">
                  The
                  <br />
                  <em>Sunday</em>
                  <span>HOUSE</span>
                </div>
                <span className="project-tag">STAY A LITTLE LONGER.</span>
              </div>
              <div className="project-label">
                <h3>The Sunday House</h3>
                <span>Identity · Web experience</span>
                <span>↗</span>
              </div>
            </article>
          </div>
        </section>
        <section className="approach" id="approach">
          <span className="eyebrow">SMALL TEAM. OPEN MINDS.</span>
          <h2>
            The best work happens
            <br />
            in conversation.
          </h2>
          <p>
            We ask good questions, listen closely, and make things together. From the first sketch
            to the final detail, your perspective is part of the process.
          </p>
          <a href="mailto:hello@example.com">Tell us what you have in mind ↗</a>
        </section>
      </main>
      <footer>
        <span className="wordmark">fieldwork®</span>
        <span>A fictional studio. Real feedback, powered by annoteer.</span>
        <span>© 2026</span>
      </footer>
      <Annoteer endpoint="http://127.0.0.1:8787" />
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
