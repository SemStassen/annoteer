import { attempt } from "./errors";

export const hash = (value: string) =>
  attempt(async () =>
    Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join(""),
  );
export const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
