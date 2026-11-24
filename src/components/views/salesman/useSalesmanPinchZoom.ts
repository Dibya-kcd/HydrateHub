import { useEffect, useRef, useState } from 'react';

export function useSalesmanPinchZoom() {
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [isPinching, setIsPinching] = useState<boolean>(false);
  const pinchContainerRef = useRef<HTMLDivElement>(null);
  const initialPinchDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1.0);

  useEffect(() => {
    const container = pinchContainerRef.current;
    if (!container) return;

    const getDistance = (touches: TouchList) => {
      return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      );
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialPinchDistRef.current = getDistance(e.touches);
        initialZoomRef.current = zoomScale;
        setIsPinching(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
        e.preventDefault();
        const currentDist = getDistance(e.touches);
        const ratio = currentDist / initialPinchDistRef.current;
        const targetZoom = Math.min(3.0, Math.max(0.75, Number((initialZoomRef.current * ratio).toFixed(2))));
        setZoomScale(targetZoom);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialPinchDistRef.current = null;
        setIsPinching(false);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [zoomScale]);

  return {
    zoomScale,
    setZoomScale,
    isPinching,
    pinchContainerRef,
  };
}
