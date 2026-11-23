import { Github, ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto relative">
      {/* Subtle top divider gradient */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="container mx-auto px-4 py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <p className="text-slate-500">
            © 2025{" "}
            <a
              href="https://github.com/Nittaany"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-200"
            >
              Satyam Chaudhary
            </a>
          </p>

          <div className="flex items-center gap-5">
            <a
              href="https://github.com/Nittaany/CashDash"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300"
            >
              <Github className="w-4 h-4" />
              <span>Source</span>
            </a>
            <a
              href="https://cashdash-api.onrender.com/api/health"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300"
            >
              <ExternalLink className="w-4 h-4" />
              <span>API</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
