function canScrollTowardTop(target: Element) {
 for (let element: Element | null = target; element; element = element.parentElement) {
  if (element.scrollTop <= 0) continue;
  if (element === document.scrollingElement || /^(auto|scroll|overlay)$/.test(getComputedStyle(element).overflowY)) return true;
 }
 return false;
}

export function preventPullToRefresh() {
 const listeners = new AbortController();
 let previous: Touch | undefined;

 document.addEventListener('touchstart', event => {
  const target = event.target;
  previous = event.touches.length === 1 && target instanceof Element
   && !target.closest('input[type="range"]') ? event.touches[0] : undefined;
 }, { passive: true, signal: listeners.signal });

 document.addEventListener('touchmove', event => {
  const start = previous;
  previous = start && event.touches.length === 1 ? event.touches[0] : undefined;
  if (!start || !previous || !event.cancelable || !(event.target instanceof Element)) return;
  const dx = previous.clientX - start.clientX, dy = previous.clientY - start.clientY;
  if (dy > Math.abs(dx) && !canScrollTowardTop(event.target)) event.preventDefault();
 }, { passive: false, signal: listeners.signal });

 return () => listeners.abort();
}
