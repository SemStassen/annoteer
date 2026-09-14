import { useEffect, useState } from "react";
import type { Annotation } from "../../domain/schema";
import { resolveAnchor } from "../anchors";

/** Reanchors open feedback after navigation, scrolling, and layout changes. */
export function useAnnotationPositions(annotations: Annotation[]) {
  const [path, setPath] = useState("");
  const [positions, setPositions] = useState<Record<string, DOMRect>>({});
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
  return { path, positions };
}
