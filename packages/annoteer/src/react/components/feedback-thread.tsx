import type { Annotation, Role } from "../../domain/schema";
import { resolveAnchor } from "../anchors";
interface FeedbackThreadProps {
  current: Annotation;
  role: Role;
  path: string;
  hasPosition: boolean;
  busy: boolean;
  onBack: () => void;
  onReply: (body: string) => void;
  onToggleStatus: () => void;
}
/** Displays a discussion, its anchor, and the actions available to the reviewer. */
export function FeedbackThread({
  current,
  role,
  path,
  hasPosition,
  busy,
  onBack,
  onReply,
  onToggleStatus,
}: FeedbackThreadProps) {
  return (
    <div>
      <button className="back" onClick={onBack}>
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
      ) : current.status === "open" && !hasPosition ? (
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
          onReply(String(data.get("body") ?? ""));
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
      {role === "agency" && (
        <div className="actions">
          <button className="primary" disabled={busy} onClick={onToggleStatus}>
            {current.status === "open" ? "✓ Mark as resolved" : "Reopen feedback"}
          </button>
        </div>
      )}
    </div>
  );
}
