"use client";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { request } from "./api";
import { styles } from "./styles";

import { useShadowRoot } from "./hooks/use-shadow-root";
import { useAnnotations } from "./hooks/use-annotations";
import { useAnnotationPositions } from "./hooks/use-annotation-positions";
import { usePageSelection } from "./hooks/use-page-selection";
import { useReviewSession } from "./hooks/use-review-session";
import { ReviewEntry } from "./components/review-entry";
import { FeedbackComposer } from "./components/feedback-composer";
import { FeedbackThread } from "./components/feedback-thread";
import { FeedbackList } from "./components/feedback-list";

export interface AnnoteerProps {
  /** Your deployed Annoteer Worker URL. */
  endpoint: string;
  /** Isolates feedback between versions of the site. Defaults to main. */
  deployment?: string;
  /** Nonce for sites with a Content Security Policy. */
  nonce?: string;
}
export function Annoteer({ endpoint, deployment = "main", nonce }: AnnoteerProps) {
  const { root, host } = useShadowRoot();

  const [panel, setPanel] = useState(false);

  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"open" | "resolved">("open");
  const [allPages, setAllPages] = useState(false);

  const { selecting, setSelecting, draft, setDraft, hover } = usePageSelection(
    host,
    setActive,
    setPanel,
    setError,
  );
  const onEnter = useCallback(() => {
    setError("");
    setDraft(null);
    setActive(null);
    setSelecting(false);
  }, [setDraft, setSelecting]);
  const { session, invitation, passwordRequired, login, logout } = useReviewSession(
    endpoint,
    onEnter,
    setPanel,
    setError,
  );
  const { annotations, refresh } = useAnnotations(endpoint, deployment, session, setError);
  const { path, positions } = useAnnotationPositions(annotations);
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
              <ReviewEntry
                passwordRequired={passwordRequired}
                busy={busy}
                onSubmit={(name, password) => void perform(() => login(name, password))}
              />
            )}
            {session && draft && (
              <FeedbackComposer
                draft={draft}
                busy={busy}
                onCancel={() => setDraft(null)}
                onSubmit={(body) =>
                  void perform(async () => {
                    await request(endpoint, "/annotations", session.token, {
                      path: location.pathname,
                      deployment,
                      anchor: draft,
                      body,
                    });
                    setDraft(null);
                    await refresh();
                  })
                }
              />
            )}
            {session && !draft && current && (
              <FeedbackThread
                current={current}
                role={session.role}
                path={path}
                hasPosition={Boolean(positions[current.id])}
                busy={busy}
                onBack={() => setActive(null)}
                onReply={(body) =>
                  void perform(async () => {
                    await request(endpoint, `/annotations/${current.id}/replies`, session.token, {
                      body,
                    });
                    await refresh();
                  })
                }
                onToggleStatus={() =>
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
              />
            )}
            {session && !draft && !current && (
              <FeedbackList
                visible={visible}
                filter={filter}
                onSelect={setActive}
                onStart={start}
              />
            )}
          </div>
          <div className="footer">
            <span>↗ annoteer · Thoughtfully noted.</span>
            {session && <button onClick={logout}>Leave review</button>}
          </div>
        </aside>
      )}
    </div>,
    root,
  );
}
