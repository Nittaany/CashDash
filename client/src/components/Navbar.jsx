import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  LayoutDashboard,
  Receipt,
  Users,
  User,
  LogOut,
  Menu,
  X,
  Wallet
} from "lucide-react";

const navLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/groups", label: "Groups", icon: Users },
  { to: "/profile", label: "Profile", icon: User }
];

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (!user) return null;

  return (
    <nav className="border-b border-slate-800/50 bg-slate-950/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <Wallet className="w-5 h-5 text-emerald-500" />
            <span className="font-semibold text-slate-100">CashDash</span>
            {user.isDemo && (
              <span className="badge badge-demo">Demo</span>
            )}
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`nav-link ${location.pathname === to ? "nav-link-active" : ""}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            <div className="w-px h-5 bg-slate-800 mx-2" />
            <button
              onClick={handleLogout}
              className="nav-link text-slate-500 hover:text-rose-400"
            >
              <LogOut className="w-4 h-4" />
              <span className="sr-only sm:not-sr-only">Logout</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-slate-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-800/50 animate-in">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                  location.pathname === to
                    ? "text-emerald-400 bg-emerald-500/10"
                    : "text-slate-400 hover:text-slate-100"
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}
            <div className="divider my-2" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 text-slate-500 hover:text-rose-400 w-full"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
