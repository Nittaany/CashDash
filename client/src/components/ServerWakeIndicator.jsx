import { useState, useEffect, useRef } from "react";
import { Loader2, Server, CheckCircle2 } from "lucide-react";

/**
 * Server wake indicator for Render free-tier cold starts
 * Shows progress while server wakes up (typically 30-50s)
 */
export function ServerWakeIndicator({ isWaking, onDismiss }) {
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState("idle"); // idle, waking, ready
  const wasWakingRef = useRef(false);

  // Track waking state changes
  useEffect(() => {
    if (isWaking && !wasWakingRef.current) {
      // Started waking
      setStatus("waking");
      setElapsed(0);
    } else if (!isWaking && wasWakingRef.current) {
      // Finished waking
      setStatus("ready");
    }
    wasWakingRef.current = isWaking;
  }, [isWaking]);

  // Elapsed time counter while waking
  useEffect(() => {
    if (status !== "waking") return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Auto-dismiss after showing ready
  useEffect(() => {
    if (status !== "ready") return;

    const timeout = setTimeout(() => {
      onDismiss?.();
      setStatus("idle");
      setElapsed(0);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [status, onDismiss]);

  if (status === "idle") return null;

  const estimatedTime = 45; // seconds
  const progress = Math.min((elapsed / estimatedTime) * 100, 95);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 shadow-lg animate-slideDown">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          {status === "ready" ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-300 text-sm font-medium">
                Server ready!
              </span>
            </>
          ) : (
            <>
              <div className="relative">
                <Server className="w-5 h-5 text-amber-400" />
                <Loader2 className="w-3 h-3 text-amber-400 animate-spin absolute -top-1 -right-1" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-amber-200 text-sm font-medium">
                    Waking server...
                  </span>
                  <span className="text-slate-400 text-xs">
                    {elapsed}s / ~{estimatedTime}s
                  </span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-slate-400 text-xs mt-1">
                  Free-tier servers sleep after 15 min idle. First request wakes them up.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
