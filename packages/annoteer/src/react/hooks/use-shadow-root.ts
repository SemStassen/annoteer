import { useEffect, useRef, useState } from "react";

/** Mounts the isolated overlay and removes it when the widget unmounts. */
export function useShadowRoot() {
  const [root, setRoot] = useState<ShadowRoot | null>(null);
  const host = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = document.createElement("div");
    node.setAttribute("data-annoteer-root", "");
    node.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;";
    const shadow = node.attachShadow({ mode: "open" });
    document.body.append(node);
    host.current = node;
    setRoot(shadow);
    return () => {
      node.remove();
      host.current = null;
    };
  }, []);
  return { root, host };
}
