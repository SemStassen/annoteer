import type { Anchor } from "../domain/schema";
const normalized = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 300);
const privateSelector =
  '[data-annoteer-ignore], input, textarea, select, [contenteditable]:not([contenteditable="false"])';
export const isPrivate = (element: Element) =>
  Boolean(element.closest(privateSelector) || element.querySelector(privateSelector));

export function selectorFor(element: Element): string {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const stable = element.getAttribute("data-annoteer-id");
  if (stable) return `[data-annoteer-id="${CSS.escape(stable)}"]`;
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.documentElement) {
    const tag = current.tagName.toLowerCase();
    const siblings: Element[] = current.parentElement
      ? Array.from(current.parentElement.children).filter(
          (child) => child.tagName === current!.tagName,
        )
      : [current];
    parts.unshift(`${tag}:nth-of-type(${siblings.indexOf(current) + 1})`);
    current = current.parentElement;
  }
  return parts.join(" > ");
}
export function captureAnchor(element: Element, range?: Range): Anchor {
  const base = {
    selector: selectorFor(element),
    tag: element.tagName.toLowerCase(),
    label: normalized(element.textContent ?? ""),
  };
  if (!range) return { ...base, kind: "element" };
  const before = document.createRange();
  before.selectNodeContents(element);
  before.setEnd(range.startContainer, range.startOffset);
  const offset = before.toString().length;
  const content = element.textContent ?? "";
  const quote = range.toString();
  return {
    ...base,
    kind: "text",
    quote,
    offset,
    prefix: content.slice(Math.max(0, offset - 60), offset),
    suffix: content.slice(offset + quote.length, offset + quote.length + 60),
  };
}

export function resolveAnchor(
  anchor: Anchor,
): { element: Element; rect: DOMRect; range?: Range } | null {
  let element: Element | null;
  try {
    element = document.querySelector(anchor.selector);
  } catch {
    return null;
  }
  if (!element || isPrivate(element) || element.tagName.toLowerCase() !== anchor.tag) return null;
  if (anchor.kind === "element") {
    if (normalized(element.textContent ?? "") !== anchor.label) return null;
    const rect = element.getBoundingClientRect();
    return rect.width || rect.height ? { element, rect } : null;
  }
  if (!anchor.quote) return null;
  const content = element.textContent ?? "";
  const candidates: number[] = [];
  let index = content.indexOf(anchor.quote);
  while (index !== -1) {
    if (
      (!anchor.prefix || content.slice(0, index).endsWith(anchor.prefix)) &&
      (!anchor.suffix || content.slice(index + anchor.quote.length).startsWith(anchor.suffix))
    )
      candidates.push(index);
    index = content.indexOf(anchor.quote, index + 1);
  }
  if (candidates.length !== 1) return null;
  const start = candidates[0];
  const end = start + anchor.quote.length;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let consumed = 0;
  let started = false;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const length = node.textContent?.length ?? 0;
    if (!started && consumed + length > start) {
      range.setStart(node, start - consumed);
      started = true;
    }
    if (started && consumed + length >= end) {
      range.setEnd(node, end - consumed);
      const rect = range.getBoundingClientRect();
      return rect.width || rect.height ? { element, range, rect } : null;
    }
    consumed += length;
  }
  return null;
}
