export const THEME_CATEGORIES = [
  { id: "Neumorphic", label: "Neumorphic" },
  { id: "Light Minimal", label: "Light Minimal" },
  { id: "Dark & Monochromatic", label: "Dark & Monochromatic" },
  { id: "Premium High-Contrast", label: "Premium High-Contrast" }
];

export const THEMES = [
  {
    id: "neo-mauve",
    name: "'neo-mauve'",
    category: "Neumorphic",
    code: "#ECE7F0",
    colors: ["#F8F5FA", "#E2DCE8", "#7C3AED"],
    vars: {
      "--bg-main": "#ECE7F0",
      "--bg-card": "#ECE7F0",
      "--bg-pill": "#E2DCE8",
      "--text-main": "#1E1B2E",
      "--text-muted": "#5A5270",
      "--accent": "#7C3AED",
      "--accent-soft": "rgba(124, 58, 237, 0.12)",
      "--border-col": "rgba(255, 255, 255, 0.75)",
      "--neu-out": "8px 8px 18px #d4ced9, -8px -8px 18px #ffffff",
      "--neu-sm": "4px 4px 10px #d4ced9, -4px -4px 10px #ffffff",
      "--neu-in": "inset 4px 4px 8px #d4ced9, inset -4px -4px 8px #ffffff",
      "--fab-bg": "#ffffff",
      "--dock-bg": "rgba(236, 231, 240, 0.72)",
      "--dock-border": "rgba(255, 255, 255, 0.85)",
      "--dock-active-bg": "#ffffff"
    }
  },
  {
    id: "neo-ice",
    name: "'neo-ice'",
    category: "Neumorphic",
    code: "#E2E8F0",
    colors: ["#F1F5F9", "#CBD5E1", "#2563EB"],
    vars: {
      "--bg-main": "#E2E8F0",
      "--bg-card": "#E2E8F0",
      "--bg-pill": "#D5DFEB",
      "--text-main": "#0F172A",
      "--text-muted": "#475569",
      "--accent": "#2563EB",
      "--accent-soft": "rgba(37, 99, 235, 0.12)",
      "--border-col": "rgba(255, 255, 255, 0.8)",
      "--neu-out": "8px 8px 18px #c7d0dc, -8px -8px 18px #fdffff",
      "--neu-sm": "4px 4px 10px #c7d0dc, -4px -4px 10px #fdffff",
      "--neu-in": "inset 4px 4px 8px #c7d0dc, inset -4px -4px 8px #fdffff",
      "--fab-bg": "#ffffff",
      "--dock-bg": "rgba(226, 232, 240, 0.72)",
      "--dock-border": "rgba(255, 255, 255, 0.85)",
      "--dock-active-bg": "#ffffff"
    }
  },
  {
    id: "light-minimal",
    name: "'pure-snow'",
    category: "Light Minimal",
    code: "#F4F5F8",
    colors: ["#FFFFFF", "#E4E7EC", "#6D28D9"],
    vars: {
      "--bg-main": "#F4F5F8",
      "--bg-card": "#FFFFFF",
      "--bg-pill": "#EAECEF",
      "--text-main": "#111827",
      "--text-muted": "#6B7280",
      "--accent": "#6D28D9",
      "--accent-soft": "rgba(109, 40, 217, 0.1)",
      "--border-col": "rgba(17, 24, 39, 0.08)",
      "--neu-out": "0 8px 24px rgba(17, 24, 39, 0.06)",
      "--neu-sm": "0 4px 12px rgba(17, 24, 39, 0.05)",
      "--neu-in": "inset 0 2px 5px rgba(17, 24, 39, 0.06)",
      "--fab-bg": "#ffffff",
      "--dock-bg": "rgba(255, 255, 255, 0.78)",
      "--dock-border": "rgba(17, 24, 39, 0.1)",
      "--dock-active-bg": "#F3F4F6"
    }
  },
  {
    id: "dark-mono",
    name: "'obsidian-mono'",
    category: "Dark & Monochromatic",
    code: "#13141C",
    colors: ["#1C1E2A", "#2A2D3D", "#8B5CF6"],
    vars: {
      "--bg-main": "#13141C",
      "--bg-card": "#191B26",
      "--bg-pill": "#222534",
      "--text-main": "#F3F4F6",
      "--text-muted": "#9CA3AF",
      "--accent": "#8B5CF6",
      "--accent-soft": "rgba(139, 92, 246, 0.16)",
      "--border-col": "rgba(255, 255, 255, 0.08)",
      "--neu-out": "7px 7px 16px #0c0d12, -7px -7px 16px #1e202e",
      "--neu-sm": "4px 4px 9px #0c0d12, -4px -4px 9px #1e202e",
      "--neu-in": "inset 4px 4px 8px #0c0d12, inset -4px -4px 8px #1e202e",
      "--fab-bg": "#1F2230",
      "--dock-bg": "rgba(22, 24, 36, 0.68)",
      "--dock-border": "rgba(255, 255, 255, 0.14)",
      "--dock-active-bg": "rgba(139, 92, 246, 0.22)"
    }
  },
  {
    id: "cyber-luxe",
    name: "'cyber-violet'",
    category: "Premium High-Contrast",
    code: "#0B0914",
    colors: ["#161224", "#2D234A", "#A855F7"],
    vars: {
      "--bg-main": "#0B0914",
      "--bg-card": "#151125",
      "--bg-pill": "#211B38",
      "--text-main": "#FAF5FF",
      "--text-muted": "#C4B5FD",
      "--accent": "#A855F7",
      "--accent-soft": "rgba(168, 85, 247, 0.2)",
      "--border-col": "rgba(168, 85, 247, 0.28)",
      "--neu-out": "0 10px 28px rgba(0, 0, 0, 0.65)",
      "--neu-sm": "0 4px 14px rgba(0, 0, 0, 0.5)",
      "--neu-in": "inset 0 2px 6px rgba(0, 0, 0, 0.7)",
      "--fab-bg": "#1E1836",
      "--dock-bg": "rgba(21, 17, 37, 0.65)",
      "--dock-border": "rgba(168, 85, 247, 0.35)",
      "--dock-active-bg": "rgba(168, 85, 247, 0.25)"
    }
  }
];