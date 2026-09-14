interface ReviewEntryProps {
  passwordRequired: boolean | null;
  busy: boolean;
  onSubmit: (name: string, password?: string) => void;
}
/** Invitation entry UI; session lifecycle belongs to useReviewSession. */
export function ReviewEntry({ passwordRequired, busy, onSubmit }: ReviewEntryProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit(String(data.get("name") ?? ""), String(data.get("password") ?? "") || undefined);
      }}
    >
      <p style={{ marginBottom: 12 }}>
        Click what catches your eye, highlight a sentence, or tell us what could be better.
      </p>
      <label>
        Your name
        <input name="name" placeholder="e.g. Alex" required maxLength={80} autoComplete="name" />
      </label>
      {passwordRequired && (
        <label>
          Review password
          <input
            name="password"
            type="password"
            required
            maxLength={72}
            autoComplete="current-password"
          />
        </label>
      )}
      <button className="primary" disabled={busy || passwordRequired === null}>
        Start reviewing ↗
      </button>
      <p className="muted">Your name and comments are visible to others reviewing this project.</p>
    </form>
  );
}
