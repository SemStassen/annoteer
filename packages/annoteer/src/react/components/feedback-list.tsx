import type { Annotation } from "../../domain/schema";
interface FeedbackListProps {
  visible: Annotation[];
  filter: "open" | "resolved";
  onSelect: (id: string) => void;
  onStart: () => void;
}
/** Feedback cards and the empty state for the active filter. */
export function FeedbackList({ visible, filter, onSelect, onStart }: FeedbackListProps) {
  return visible.length ? (
    visible.map((item) => (
      <button className="card" key={item.id} onClick={() => onSelect(item.id)}>
        <div className="meta">
          <span className="avatar">{item.author.slice(0, 1).toUpperCase()}</span>
          {item.author}
          <span className="status">
            {item.replies.length ? `${item.replies.length} replies` : item.anchor.kind}
          </span>
        </div>
        <p className="note">{item.body}</p>
        <div className="quote">{item.anchor.quote || item.anchor.label || item.anchor.tag}</div>
        <p className="muted">{item.path}</p>
      </button>
    ))
  ) : (
    <div className="empty">
      <span className="symbol">↗</span>
      <strong>
        {filter === "open" ? "Room for your perspective." : "Good things take feedback."}
      </strong>
      <p>
        {filter === "open"
          ? "Point to something on the page and leave your first note."
          : "Resolved notes will appear here."}
      </p>
      {filter === "open" && (
        <button className="secondary" style={{ marginTop: 20 }} onClick={onStart}>
          + Add feedback
        </button>
      )}
    </div>
  );
}
