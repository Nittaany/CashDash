import { Github, ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-800/50 bg-slate-950/80 backdrop-blur-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Copyright */}
          <div className="text-slate-400 text-sm">
            © 2025{" "}
            <a
              href="https://github.com/Nittaany"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-emerald-400 transition-colors"
            >
              Satyam Chaudhary
            </a>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/Nittaany/CashDash"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-sm"
            >
              <Github className="w-4 h-4" />
              <span>Source</span>
            </a>
            <a
              href="https://cashdash-api.onrender.com/api/health"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span>API Status</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
