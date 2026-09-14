import { useEffect, useState, type RefObject } from "react";
import type { Anchor } from "../../domain/schema";
import { captureAnchor, isPrivate } from "../anchors";

/** Captures text or elements while excluding the overlay and private fields. */
export function usePageSelection(
  host: RefObject<HTMLDivElement | null>,
  setActive: (id: string | null) => void,
  setPanel: (open: boolean) => void,
  setError: (error: string) => void,
) {
  const [selecting, setSelecting] = useState(false);
  const [draft, setDraft] = useState<Anchor | null>(null);
  const [hover, setHover] = useState<DOMRect | null>(null);
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
  }, [selecting, host, setActive, setPanel, setError]);
  return { selecting, setSelecting, draft, setDraft, hover };
}
