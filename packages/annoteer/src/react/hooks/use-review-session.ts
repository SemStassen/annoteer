import { useEffect, useState } from "react";
import type { Session } from "../../domain/schema";
import { request } from "../api";

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
/** Owns invitation fragments and session storage; passwords are never persisted. */
export function useReviewSession(
  endpoint: string,
  onEnter: () => void,
  setPanel: (open: boolean) => void,
  setError: (error: string) => void,
) {
  const [session, setSession] = useState<Session | null>(null);
  const [invitation, setInvitation] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState<boolean | null>(null);
  const key = `annoteer:${endpoint.replace(/\/$/, "")}`;
  useEffect(() => {
    let revision = 0;
    const enter = () => {
      const current = ++revision;
      setSession(null);
      setInvitation(null);
      onEnter();
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
  }, [endpoint, key, onEnter, setError, setPanel]);
  useEffect(() => {
    setPasswordRequired(null);
    if (!invitation) return;
    let cancelled = false;
    request<{ passwordRequired: boolean }>(endpoint, "/review-access", undefined, {
      token: invitation,
    })
      .then((data) => {
        if (!cancelled) setPasswordRequired(data.passwordRequired);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, invitation, setError]);
  const login = async (name: string, password?: string) => {
    const next = await request<Session>(endpoint, "/sessions", undefined, {
      token: invitation,
      name,
      password,
    });
    storage.set(key, JSON.stringify(next));
    storage.remove(`${key}:invite`);
    setSession(next);
    setInvitation(null);
  };
  const logout = () => {
    storage.remove(key);
    setSession(null);
    setInvitation(null);
    setPanel(false);
    setError("");
  };
  return { session, invitation, passwordRequired, login, logout };
}
