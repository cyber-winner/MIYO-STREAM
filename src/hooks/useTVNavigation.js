import { useEffect, useCallback, useRef } from 'react';
import { useDevice } from '../context/DeviceContext';
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea';
export function useTVNavigation(containerRef) {
  const { isTv } = useDevice();
  const currentFocusRef = useRef(null);
  const getFocusableElements = useCallback(() => {
    if (!containerRef?.current) return [];
    return Array.from(containerRef.current.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null
    );
  }, [containerRef]);
  const getClosestElement = useCallback((current, elements, direction) => {
    if (!current) return elements[0] || null;
    const currentRect = current.getBoundingClientRect();
    const cx = currentRect.left + currentRect.width / 2;
    const cy = currentRect.top + currentRect.height / 2;
    let candidates = elements.filter((el) => {
      if (el === current) return false;
      const rect = el.getBoundingClientRect();
      const ex = rect.left + rect.width / 2;
      const ey = rect.top + rect.height / 2;
      switch (direction) {
        case 'ArrowUp': return ey < cy - 10;
        case 'ArrowDown': return ey > cy + 10;
        case 'ArrowLeft': return ex < cx - 10;
        case 'ArrowRight': return ex > cx + 10;
        default: return false;
      }
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      const ax = aRect.left + aRect.width / 2;
      const ay = aRect.top + aRect.height / 2;
      const bx = bRect.left + bRect.width / 2;
      const by = bRect.top + bRect.height / 2;
      const distA = Math.sqrt((ax - cx) ** 2 + (ay - cy) ** 2);
      const distB = Math.sqrt((bx - cx) ** 2 + (by - cy) ** 2);
      return distA - distB;
    });
    return candidates[0];
  }, []);
  const handleKeyDown = useCallback(
    (e) => {
      if (!isTv) return;
      const directions = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (directions.includes(e.key)) {
        e.preventDefault();
        const elements = getFocusableElements();
        const current = document.activeElement;
        const next = getClosestElement(current, elements, e.key);
        if (next) {
          next.focus();
          next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          currentFocusRef.current = next;
        }
      }
      if (e.key === 'Enter') {
        const active = document.activeElement;
        if (active && active !== document.body) {
          active.click();
        }
      }
      if (e.key === 'Backspace' || e.key === 'Escape') {
        window.history.back();
      }
    },
    [isTv, getFocusableElements, getClosestElement]
  );
  useEffect(() => {
    if (!isTv) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isTv, handleKeyDown]);
  return { isTv };
}