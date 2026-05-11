import React from "react";
import { NavLink } from "react-router-dom";
import { Coffee, Github, Music } from "lucide-react";
import NotationSwitch from "./NotationSwitch";

const navItems = [
  { to: "/harmonica", label: "Harmonica" },
  { to: "/musicxml", label: "Tabs" },
  { to: "/practice", label: "Practice" },
  { to: "/circle", label: "Circle" },
];

const Menu: React.FC = () => (
  <nav className="overflow-x-hidden border-b border-gray-800 bg-gray-950/95 text-white">
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <NavLink
          to="/harmonica"
          className="inline-flex min-h-10 items-center gap-2 rounded text-sm font-bold tracking-normal text-white transition hover:text-cyan-200"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded border border-cyan-500/50 bg-cyan-500/10 text-cyan-200">
            <Music className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>NoteBender</span>
        </NavLink>
        <NotationSwitch />
      </div>

      <div className="app-scroll-x flex min-w-0 items-center gap-2 pb-1 lg:flex-1 lg:justify-center lg:pb-0">
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `inline-flex min-h-9 shrink-0 items-center rounded px-3 text-sm font-semibold transition ${
                isActive
                  ? "bg-cyan-500 text-gray-950"
                  : "text-gray-300 hover:bg-gray-900 hover:text-white"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 border-t border-gray-800 pt-3 lg:border-t-0 lg:pt-0">
        <a
          href="https://buymeacoffee.com/ikzzet"
          target="_blank"
          rel="noopener noreferrer"
          className="app-button app-button-warning min-h-9 px-3 py-1.5"
          title="Buy me a coffee"
          aria-label="Buy me a coffee"
        >
          <Coffee className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Support</span>
        </a>
        <a
          href="https://github.com/izabala033/NoteBender"
          target="_blank"
          rel="noopener noreferrer"
          className="app-icon-button h-9 w-9"
          title="GitHub Repository"
          aria-label="GitHub Repository"
        >
          <Github className="h-5 w-5" aria-hidden="true" />
        </a>
      </div>
    </div>
  </nav>
);

export default Menu;
