import { useState } from "react";
import { THEME_CATEGORIES, THEMES } from "../constants/themes";
import { IconPalette } from "./Icons";

export default function ThemeSelector({ currentThemeId, onSelectTheme }) {
  const activeThemeObj = THEMES.find((t) => t.id === currentThemeId) || THEMES[0];
  const [selectedCategory, setSelectedCategory] = useState(activeThemeObj.category);

  const filteredThemes = THEMES.filter((t) => t.category === selectedCategory);

  return (
    <section className="neu-card theme-engine-card">
      <div className="theme-engine-header">
        <div className="neu-icon-box">
          <IconPalette size={22} />
        </div>
        <div style={{ textAlign: "right" }}>
          <h2 className="engine-title">موتور پوسته ۱۲گانه Cyber-Luxe 2026</h2>
          <p className="engine-sub">
            انتخاب از بین دسته‌های Premium، Dark & Monochromatic، High-Contrast، Light Minimal و Neumorphic
          </p>
        </div>
      </div>

      <div className="category-grid">
        {THEME_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`cat-pill-btn ${selectedCategory === cat.id ? "active" : ""}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="theme-cards-stack">
        {filteredThemes.map((t) => {
          const isActive = t.id === currentThemeId;
          return (
            <div
              key={t.id}
              className={`theme-option-card ${isActive ? "selected" : ""}`}
              onClick={() => onSelectTheme(t.id)}
            >
              <div className="color-swatches">
                {t.colors.map((hex, i) => (
                  <span key={i} className="swatch-circle" style={{ backgroundColor: hex }} />
                ))}
              </div>

              <div className="theme-option-info">
                <div className="theme-name-row">
                  {isActive && <span className="active-tag">ACTIVE</span>}
                  <strong className="theme-code-name">{t.name}</strong>
                </div>
                <span className="theme-meta-text">
                  {t.category} • {t.code}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}