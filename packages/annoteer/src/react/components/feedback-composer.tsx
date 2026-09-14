import type { Anchor } from "../../domain/schema";
interface FeedbackComposerProps {
  draft: Anchor;
  busy: boolean;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}
/** Composes a note for the selected page anchor. */
export function FeedbackComposer({ draft, busy, onSubmit, onCancel }: FeedbackComposerProps) {
  return (
    <form
      key={draft.selector + draft.quote}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit(String(data.get("body") ?? ""));
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
      <button type="button" className="secondary" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
