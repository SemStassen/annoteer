"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Anchor, Annotation, Session } from "../../shared/schema";
import { captureAnchor, isPrivate, resolveAnchor } from "./anchors";
import { request } from "./api";
import { styles } from "./styles";

export interface AnnoteerProps {
  /** Your deployed Annoteer Worker URL. */
  endpoint: string;
  /** Isolates feedback between versions of the site. Defaults to main. */
  deployment?: string;
  /** Nonce for sites with a Content Security Policy. */
  nonce?: string;
}
const storage = {
  get(key: string) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* In-memory review still works. */
    }
  },
  remove(key: string) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Storage may be disabled. */
    }
  },
};
export function Annoteer({ endpoint, deployment = "main", nonce }: AnnoteerProps) {
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const host = useRef<HTMLDivElement | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [invitation, setInvitation] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [draft, setDraft] = useState<Anchor | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"open" | "resolved">("open");
  const [allPages, setAllPages] = useState(false);
  const [path, setPath] = useState("");
  const [hover, setHover] = useState<DOMRect | null>(null);
  const [positions, setPositions] = useState<Record<string, DOMRect>>({});
  const key = `annoteer:${endpoint.replace(/\/$/, "")}`;
  useEffect(() => {
    const node = document.createElement("div");
    node.setAttribute("data-annoteer-root", "");
    node.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;";
    const shadow = node.attachShadow({ mode: "open" });
    document.body.append(node);
    host.current = node;
    setRoot(shadow);
    return () => {
      node.remove();
      host.current = null;
    };
  }, []);
  useEffect(() => {
    let revision = 0;
    const enter = () => {
      const current = ++revision;
      setSession(null);
      setInvitation(null);
      setAnnotations([]);
      setError("");
      setDraft(null);
      setActive(null);
      setSelecting(false);
      const params = new URLSearchParams(location.hash.slice(1));
      const secret = params.get("annoteer");
      if (secret) {
        storage.set(`${key}:invite`, secret);
        params.delete("annoteer");
        history.replaceState(
          history.state,
          "",
          `${location.pathname}${location.search}${params.size ? `#${params}` : ""}`,
        );
        storage.remove(key);
      }
      const pending = secret ?? storage.get(`${key}:invite`);
      if (pending) {
        setInvitation(pending);
        setPanel(true);
        return;
      }
      const saved = storage.get(key);
      if (!saved) return;
      try {
        const candidate = JSON.parse(saved) as Session;
        request<Omit<Session, "token">>(endpoint, "/session", candidate.token)
          .then((data) => {
            if (revision === current) setSession({ ...data, token: candidate.token });
          })
          .catch(() => {
            if (revision === current) {
              storage.remove(key);
              setError("Your review session ended. Reopen your invitation link.");
              setPanel(true);
            }
          });
      } catch {
        storage.remove(key);
      }
    };
    const onHashChange = () => {
      if (new URLSearchParams(location.hash.slice(1)).has("annoteer")) enter();
    };
    enter();
    window.addEventListener("hashchange", onHashChange);
    return () => {
      revision++;
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [endpoint, key]);
  const refresh = useCallback(async () => {
    if (!session) return;
    const data = await request<Annotation[]>(
      endpoint,
      `/annotations?deployment=${encodeURIComponent(deployment)}`,
      session.token,
    );
    setAnnotations(data);
  }, [endpoint, deployment, session]);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const update = () =>
      request<Annotation[]>(
        endpoint,
        `/annotations?deployment=${encodeURIComponent(deployment)}`,
        session.token,
      )
        .then((data) => {
          if (!cancelled) setAnnotations(data);
        })
        .catch((cause: Error) => {
          if (!cancelled) setError(cause.message);
        });
    void update();
    const timer = setInterval(() => {
      if (!document.hidden) void update();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [endpoint, deployment, session]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = location.pathname;
        setPath(current);
        const next: Record<string, DOMRect> = {};
        for (const annotation of annotations)
          if (annotation.path === current && annotation.status === "open") {
            const target = resolveAnchor(annotation.anchor);
            if (target) next[annotation.id] = target.rect;
          }
        setPositions(next);
      });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    const resize = new ResizeObserver(update);
    resize.observe(document.body);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const timer = setInterval(update, 1000);
    return () => {
      observer.disconnect();
      resize.disconnect();
      clearInterval(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [annotations]);
  useEffect(() => {
    const own = (event: Event) => host.current && event.composedPath().includes(host.current);
    const choose = (anchor: Anchor) => {
      setDraft(anchor);
      setActive(null);
      setPanel(true);
      setSelecting(false);
      setHover(null);
    };
    const move = (event: MouseEvent) => {
      const element = event.target;
      setHover(
        selecting && !own(event) && element instanceof Element && !isPrivate(element)
          ? element.getBoundingClientRect()
          : null,
      );
    };
    const click = (event: MouseEvent) => {
      if (!selecting || own(event) || !(event.target instanceof Element) || isPrivate(event.target))
        return;
      event.preventDefault();
      event.stopPropagation();
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      choose(captureAnchor(event.target));
    };
    const mouseup = (event: MouseEvent) => {
      if (!selecting || own(event)) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const element = node instanceof Element ? node : node.parentElement;
      if (
        !element ||
        isPrivate(element) ||
        element.querySelector('[data-annoteer-ignore],input,textarea,[contenteditable="true"]')
      )
        return;
      if (range.toString().length > 2000) {
        setError("Select a shorter passage (up to 2,000 characters).");
        setPanel(true);
        return;
      }
      choose(captureAnchor(element, range));
      selection.removeAllRanges();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelecting(false);
        setDraft(null);
        setHover(null);
        setPanel(false);
      }
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("click", click, true);
    document.addEventListener("mouseup", mouseup);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("click", click, true);
      document.removeEventListener("mouseup", mouseup);
      document.removeEventListener("keydown", escape);
    };
  }, [selecting]);
  const perform = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const current = annotations.find((item) => item.id === active);
  const visible = annotations.filter(
    (item) => item.status === filter && (allPages || item.path === path),
  );
  const start = () => {
    setDraft(null);
    setActive(null);
    setSelecting(true);
    setPanel(false);
    setError("");
  };
  if (!root || (!session && !invitation && !error)) return null;
  const positionStyle = (rect: DOMRect) => ({
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  });
  return createPortal(
    <div className="a">
      <style nonce={nonce}>{styles}</style>
      {hover && selecting && <div className="outline" style={positionStyle(hover)} />}
      {session &&
        Object.entries(positions).map(([id, rect], index) => (
          <button
            key={id}
            className="pin"
            style={{
              top: Math.max(2, rect.top - 12),
              left: Math.min(innerWidth - 28, Math.max(2, rect.right - 12)),
              display: rect.bottom < 0 || rect.top > innerHeight ? "none" : undefined,
            }}
            aria-label={`Open feedback ${index + 1}`}
            onClick={() => {
              setActive(id);
              setDraft(null);
              setPanel(true);
            }}
          >
            {index + 1}
          </button>
        ))}
      {selecting && (
        <div className="hint">
          Click an element or highlight text.
          <br />
          Press Esc to cancel.
        </div>
      )}
      {session && (
        <div className="bar" style={{ pointerEvents: "auto" }}>
          <span className="brand">↗ annoteer</span>
          <button
            className="count"
            onClick={() => {
              setPanel(!panel);
              setSelecting(false);
            }}
          >
            {annotations.filter((item) => item.status === "open").length} open
          </button>
          <button className="add" onClick={selecting ? () => setSelecting(false) : start}>
            {selecting ? "Cancel" : "+ Add feedback"}
          </button>
        </div>
      )}
      {panel && (
        <aside className="panel" style={{ pointerEvents: "auto" }} aria-label="Annoteer feedback">
          <div className="header">
            <div>
              <h2>
                {!session
                  ? "A fresh pair of eyes."
                  : draft
                    ? "Leave a note."
                    : "A little feedback."}
              </h2>
              <p className="muted">
                {!session
                  ? "Your thoughts, right where they belong."
                  : `${session.name} · ${session.role === "agency" ? "Agency" : "Client review"}`}
              </p>
            </div>
            <button className="close" aria-label="Close feedback" onClick={() => setPanel(false)}>
              ×
            </button>
          </div>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {session && !draft && !current && (
            <div className="tabs">
              <button aria-pressed={filter === "open"} onClick={() => setFilter("open")}>
                Open
              </button>
              <button aria-pressed={filter === "resolved"} onClick={() => setFilter("resolved")}>
                Resolved
              </button>
              <button aria-pressed={allPages} onClick={() => setAllPages(!allPages)}>
                {allPages ? "All pages" : "This page"}
              </button>
            </div>
          )}
          <div className="scroll">
            {!session && invitation && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void perform(async () => {
                    const next = await request<Session>(endpoint, "/sessions", undefined, {
                      token: invitation,
                      name: data.get("name"),
                    });
                    storage.set(key, JSON.stringify(next));
                    storage.remove(`${key}:invite`);
                    setSession(next);
                    setInvitation(null);
                  });
                }}
              >
                <p style={{ marginBottom: 12 }}>
                  Click what catches your eye, highlight a sentence, or tell us what could be
                  better.
                </p>
                <label>
                  Your name
                  <input
                    name="name"
                    placeholder="e.g. Alex"
                    required
                    maxLength={80}
                    autoComplete="name"
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Start reviewing ↗
                </button>
                <p className="muted">
                  Your name and comments are visible to others reviewing this project.
                </p>
              </form>
            )}
            {session && draft && (
              <form
                key={draft.selector + draft.quote}
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void perform(async () => {
                    await request(endpoint, "/annotations", session.token, {
                      path: location.pathname,
                      deployment,
                      anchor: draft,
                      body: data.get("body"),
                    });
                    setDraft(null);
                    await refresh();
                  });
                }}
              >
                <div className="quote">{draft.quote ?? draft.label ?? draft.tag}</div>
                <label>
                  What would you change?
                  <textarea
                    name="body"
                    placeholder="A little more breathing room here…"
                    required
                    maxLength={5000}
                    autoFocus
                  />
                </label>
                <button className="primary" disabled={busy}>
                  Add feedback ↗
                </button>
                <button type="button" className="secondary" onClick={() => setDraft(null)}>
                  Cancel
                </button>
              </form>
            )}
            {session && !draft && current && (
              <div>
                <button className="back" onClick={() => setActive(null)}>
                  ← All feedback
                </button>
                <div className="meta">
                  <span className="avatar">{current.author.slice(0, 1).toUpperCase()}</span>
                  {current.author}
                  <span className="status">{current.status}</span>
                </div>
                <p className="note">{current.body}</p>
                <div className="quote">
                  {current.anchor.quote || current.anchor.label || current.anchor.tag}
                </div>
                <p className="muted">{current.path}</p>
                {current.path !== path ? (
                  <a href={current.path}>Go to this page ↗</a>
                ) : current.status === "open" && !positions[current.id] ? (
                  <p className="muted">Target changed or is currently hidden.</p>
                ) : (
                  <button
                    className="back"
                    style={{ marginTop: 12 }}
                    onClick={() =>
                      resolveAnchor(current.anchor)?.element.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      })
                    }
                  >
                    Show on page ↗
                  </button>
                )}
                {current.replies.map((reply) => (
                  <div className="reply" key={reply.id}>
                    <div className="meta">
                      <span className="avatar">{reply.author.slice(0, 1).toUpperCase()}</span>
                      {reply.author} {reply.role === "agency" && "· Agency"}
                    </div>
                    <p className="note">{reply.body}</p>
                  </div>
                ))}
                <form
                  key={current.id + current.replies.length}
                  style={{ marginTop: 18 }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    void perform(async () => {
                      await request(endpoint, `/annotations/${current.id}/replies`, session.token, {
                        body: data.get("body"),
                      });
                      await refresh();
                    });
                  }}
                >
                  <label>
                    Keep the conversation going
                    <textarea name="body" placeholder="Write a reply…" required maxLength={5000} />
                  </label>
                  <button className="secondary" disabled={busy}>
                    Reply
                  </button>
                </form>
                {session.role === "agency" && (
                  <div className="actions">
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void perform(async () => {
                          await request(
                            endpoint,
                            `/annotations/${current.id}`,
                            session.token,
                            { status: current.status === "open" ? "resolved" : "open" },
                            "PATCH",
                          );
                          await refresh();
                        })
                      }
                    >
                      {current.status === "open" ? "✓ Mark as resolved" : "Reopen feedback"}
                    </button>
                  </div>
                )}
              </div>
            )}
            {session &&
              !draft &&
              !current &&
              (visible.length ? (
                visible.map((item) => (
                  <button className="card" key={item.id} onClick={() => setActive(item.id)}>
                    <div className="meta">
                      <span className="avatar">{item.author.slice(0, 1).toUpperCase()}</span>
                      {item.author}
                      <span className="status">
                        {item.replies.length ? `${item.replies.length} replies` : item.anchor.kind}
                      </span>
                    </div>
                    <p className="note">{item.body}</p>
                    <div className="quote">
                      {item.anchor.quote || item.anchor.label || item.anchor.tag}
                    </div>
                    <p className="muted">{item.path}</p>
                  </button>
                ))
              ) : (
                <div className="empty">
                  <span className="symbol">↗</span>
                  <strong>
                    {filter === "open"
                      ? "Room for your perspective."
                      : "Good things take feedback."}
                  </strong>
                  <p>
                    {filter === "open"
                      ? "Point to something on the page and leave your first note."
                      : "Resolved notes will appear here."}
                  </p>
                  {filter === "open" && (
                    <button className="secondary" style={{ marginTop: 20 }} onClick={start}>
                      + Add feedback
                    </button>
                  )}
                </div>
              ))}
          </div>
          <div className="footer">
            <span>↗ annoteer · Thoughtfully noted.</span>
            {session && (
              <button
                onClick={() => {
                  storage.remove(key);
                  setSession(null);
                  setInvitation(null);
                  setPanel(false);
                  setError("");
                }}
              >
                Leave review
              </button>
            )}
          </div>
        </aside>
      )}
    </div>,
    root,
  );
}
