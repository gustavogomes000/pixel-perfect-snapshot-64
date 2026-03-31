import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  trackPageView,
  initUniversalClickTracker,
  initScrollTracking,
  initExitTracking,
  initSession,
  flushQueue,
  startGPSResolution,
  getVisitorId,
  retroactiveEnrich,
} from "@/lib/tracking";

let clickTrackerInitialized = false;

export default function TrackingProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const cleanupRef = useRef<(() => void) | null>(null);
  const exitCleanupRef = useRef<(() => void) | null>(null);

  // One-time initialization
  useEffect(() => {
    try {
      getVisitorId();
      initSession();

      if (!clickTrackerInitialized) {
        initUniversalClickTracker();
        clickTrackerInitialized = true;
      }

      // FIX 1: Force GPS immediately on every page load
      startGPSResolution().then((geo) => {
        // FIX 7: When GPS resolves, retroactively enrich old records
        if (geo && geo.bairro) {
          retroactiveEnrich().catch(() => {});
        }
      }).catch(() => {});

      // Flush failed queue
      flushQueue().catch(() => {});
    } catch { /* RULE 2 */ }
  }, []);

  // Per-page tracking
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;

    try {
      trackPageView(location.pathname);

      if (cleanupRef.current) cleanupRef.current();
      cleanupRef.current = initScrollTracking(location.pathname);

      if (exitCleanupRef.current) exitCleanupRef.current();
      exitCleanupRef.current = initExitTracking(location.pathname);
    } catch { /* RULE 2 */ }

    return () => {
      try { if (cleanupRef.current) cleanupRef.current(); cleanupRef.current = null; } catch {}
    };
  }, [location.pathname]);

  return <>{children}</>;
}
