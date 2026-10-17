import { IconHome, IconSearch, IconBell, IconPalette, IconShield } from "./Icons";

export default function RadialMenu({ activeTab, onSelectTab, hasAdminAccess, unreadCount }) {
  const items = [
    { id: "dashboard", label: "برنامه کلاسی", Icon: IconHome },
    { id: "search", label: "جستجو", Icon: IconSearch },
    { id: "notifications", label: "اعلان‌ها", Icon: IconBell, badge: unreadCount },
    { id: "themes", label: "پوسته‌ها", Icon: IconPalette }
  ];

  if (hasAdminAccess) {
    items.push({ id: "admin", label: "مدیریت", Icon: IconShield });
  }

  return (
    <div className="glass-dock-container">
      <nav className="glass-dock-bar" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => {
          const ItemIcon = item.Icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`glass-dock-item ${isActive ? "active" : ""}`}
              onClick={() => onSelectTab(item.id)}
            >
              <div className="dock-icon-wrap">
                <ItemIcon size={20} />
                {item.badge > 0 && <span className="dock-badge-dot">{item.badge}</span>}
              </div>
              <span className="dock-item-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}