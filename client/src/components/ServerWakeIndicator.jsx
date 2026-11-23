import { useState, useEffect, useRef } from "react";
import { Loader2, Server, CheckCircle2 } from "lucide-react";

/**
 * Server wake indicator for Render free-tier cold starts.
 * Only shows if the health check takes longer than SHOW_DELAY_MS.
 * If the backend responds quickly, renders nothing.
 */
const SHOW_DELAY_MS = 1500;
const DISMISS_DELAY_MS = 1800;
const ESTIMATED_WAKE_TIME = 45;

export function ServerWakeIndicator({ isWaking, onDismiss }) {
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | waking | ready
  const wasWakingRef = useRef(false);
  const showTimerRef = useRef(null);

  useEffect(() => {
    if (isWaking && !wasWakingRef.current) {
      // Don't show immediately — wait SHOW_DELAY_MS before revealing
      showTimerRef.current = setTimeout(() => {
        setStatus("waking");
        setElapsed(0);
      }, SHOW_DELAY_MS);
    } else if (!isWaking && wasWakingRef.current) {
      // Server responded. If we never showed the banner, stay idle.
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
      setStatus((prev) => (prev === "waking" ? "ready" : "idle"));
    }
    wasWakingRef.current = isWaking;

    return () => {
      if (!isWaking) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };
  }, [isWaking]);

  // Elapsed counter while waking
  useEffect(() => {
    if (status !== "waking") return;
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Auto-dismiss after showing "Connected"
  useEffect(() => {
    if (status !== "ready") return;
    const timeout = setTimeout(() => {
      onDismiss?.();
      setStatus("idle");
      setElapsed(0);
    }, DISMISS_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [status, onDismiss]);

  if (status === "idle") return null;

  const progress = Math.min((elapsed / ESTIMATED_WAKE_TIME) * 100, 95);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
      <div className="mx-auto max-w-2xl px-4 pt-3 pb-3">
        <div className="rounded-xl border border-white/[0.06] bg-[#0c1017]/90 backdrop-blur-lg px-5 py-3.5 shadow-lg shadow-black/30">
          {status === "ready" ? (
            <div className="flex items-center gap-2.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Connected</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <Server className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">Connecting to server…</span>
                </div>
                <span className="text-xs text-slate-500 tabular-nums font-medium">
                  {elapsed}s / ~{ESTIMATED_WAKE_TIME}s
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-slate-500">
                Free-tier servers sleep after inactivity. First request wakes them.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
