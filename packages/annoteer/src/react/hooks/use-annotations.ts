import { useCallback, useEffect, useState } from "react";
import type { Annotation, Session } from "../../domain/schema";
import { request } from "../api";

/** Keeps deployment feedback current while the tab is visible. */
export function useAnnotations(
  endpoint: string,
  deployment: string,
  session: Session | null,
  setError: (error: string) => void,
) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const refresh = useCallback(async () => {
    if (!session) return;
    const data = await request<Annotation[]>(
      endpoint,
      `/annotations?deployment=${encodeURIComponent(deployment)}`,
      session.token,
    );
    setAnnotations(data);
  }, [endpoint, deployment, session, setError]);
  useEffect(() => {
    if (!session) {
      setAnnotations([]);
      return;
    }
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
  }, [endpoint, deployment, session, setError]);
  return { annotations, refresh };
}
