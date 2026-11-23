import { useState, useEffect, useRef } from "react";
import { Loader2, Server, CheckCircle2 } from "lucide-react";

/**
 * Server wake indicator for Render free-tier cold starts
 */
export function ServerWakeIndicator({ isWaking, onDismiss }) {
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState("idle");
  const wasWakingRef = useRef(false);

  useEffect(() => {
    if (isWaking && !wasWakingRef.current) {
      setStatus("waking");
      setElapsed(0);
    } else if (!isWaking && wasWakingRef.current) {
      setStatus("ready");
    }
    wasWakingRef.current = isWaking;
  }, [isWaking]);

  useEffect(() => {
    if (status !== "waking") return;
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

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

  const estimatedTime = 45;
  const progress = Math.min((elapsed / estimatedTime) * 100, 95);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800/50 animate-slide-down">
      <div className="container mx-auto px-4 py-3">
        {status === "ready" ? (
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">Connected</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300">
                <Server className="w-4 h-4" />
                <span className="text-sm">Connecting to server...</span>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {elapsed}s / ~{estimatedTime}s
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
  );
}
