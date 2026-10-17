import { useEffect, useState, useMemo } from "react";
import { THEMES } from "./constants/themes";
import {
  IconCap,
  IconBell,
  IconUser,
  IconCalendar,
  IconSearch,
  IconClock,
  IconMapPin,
  IconEdit,
  IconTrash
} from "./components/Icons";
import RadialMenu from "./components/RadialMenu";
import ThemeSelector from "./components/ThemeSelector";
import AdminPanel from "./components/AdminPanel";
import "./App.css";

const DEFAULT_API_URL = "";
const DAYS = ["همه", "شنبه", "یکشنبه", "دوشنبه", "سه شنبه", "چهارشنبه"];

const TIME_SLOTS = [
  { id: "همه", label: "همه ساعات", startHour: null },
  { id: "08-10", label: "۸ تا ۱۰", startHour: 8 },
  { id: "10-12", label: "۱۰ تا ۱۲", startHour: 10 },
  { id: "12-14", label: "۱۲ تا ۱۴", startHour: 12 },
  { id: "14-16", label: "۱۴ تا ۱۶", startHour: 14 },
  { id: "16-18", label: "۱۶ تا ۱۸", startHour: 16 },
  { id: "18-20", label: "۱۸ تا ۲۰", startHour: 18 }
];

function normalizeText(str = "") {
  return String(str || "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/یک شنبه/g, "یکشنبه")
    .replace(/سه\u200cشنبه/g, "سه شنبه")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();
}

function formatTimeSlotLabel(rawTime = "") {
  const norm = normalizeText(rawTime);
  const m = norm.match(/(\d{1,2}):\d{2}\s*-\s*(\d{1,2}):\d{2}/);
  if (m) {
    const h1 = parseInt(m[1], 10);
    const h2 = parseInt(m[2], 10);
    const toFa = (n) => n.toLocaleString("fa-IR");
    return `${toFa(Math.min(h1, h2))} تا ${toFa(Math.max(h1, h2))}`;
  }
  return rawTime;
}

function matchesTimeSlot(rawTime = "", slotId = "همه") {
  if (slotId === "همه") return true;
  const slot = TIME_SLOTS.find((s) => s.id === slotId);
  if (!slot || slot.startHour === null) return true;

  const norm = normalizeText(rawTime);
  const matches = norm.match(/(\d{1,2}):\d{2}/g);
  if (matches && matches.length >= 1) {
    const hours = matches.map((t) => parseInt(t.split(":")[0], 10));
    const startH = Math.min(...hours);
    return startH === slot.startHour;
  }
  return norm.includes(String(slot.startHour));
}

export default function App() {
  const [themeId, setThemeId] = useState(() => localStorage.getItem("uni_theme_id") || "neo-mauve");
  const [activeTab, setActiveTab] = useState("dashboard");

  const [apiUrl, setApiUrl] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const apiFromUrl = urlParams.get("api");
    if (apiFromUrl) {
      localStorage.setItem("uni_api_url", apiFromUrl);
      return apiFromUrl;
    }
    return localStorage.getItem("uni_api_url") || DEFAULT_API_URL;
  });

  const [incomingTgFile, setIncomingTgFile] = useState(null);
  const [logoTaps, setLogoTaps] = useState(0);
  const [nowTime, setNowTime] = useState("");
  const [jalaliDate, setJalaliDate] = useState("");
  const [telegramUser, setTelegramUser] = useState({ id: "Web-User" });

  const [superCreds, setSuperCreds] = useState(() => {
    try {
      const saved = localStorage.getItem("uni_super_creds");
      return saved
        ? JSON.parse(saved)
        : { username: "admin", password: "admin1234", display_name: "مدیر کل سامانه" };
    } catch {
      return { username: "admin", password: "admin1234", display_name: "مدیر کل سامانه" };
    }
  });

  // بدون هیچ کلاس یا اعلان پیش‌فرض (کاملاً خام تا زمان بارگذاری اکسل)
  const [classes, setClasses] = useState(() => {
    try {
      const saved = localStorage.getItem("uni_cached_classes_v2");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // بدون ادیتور پیش‌فرض
  const [editors, setEditors] = useState(() => {
    try {
      const saved = localStorage.getItem("uni_editors_list_v2");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [auditLogs, setAuditLogs] = useState(() => {
    try {
      const saved = localStorage.getItem("uni_audit_logs");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [session, setSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem("uni_auth_session");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [selectedDay, setSelectedDay] = useState("همه");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("all");
  const [timeSlot, setTimeSlot] = useState("همه");
  const [editingClass, setEditingClass] = useState(null);

  useEffect(() => {
    const found = THEMES.find((t) => t.id === themeId) || THEMES[0];
    Object.entries(found.vars).forEach(([key, val]) => {
      document.documentElement.style.setProperty(key, val);
    });
    localStorage.setItem("uni_theme_id", themeId);
  }, [themeId]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setNowTime(
        new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now)
      );
      setJalaliDate(new Intl.DateTimeFormat("fa-IR-u-ca-persian").format(now));
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);

    const jsDay = new Date().getDay();
    const dayMap = { 6: "شنبه", 0: "یکشنبه", 1: "دوشنبه", 2: "سه شنبه", 3: "چهارشنبه" };
    if (dayMap[jsDay]) setSelectedDay(dayMap[jsDay]);

    try {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        const u = tg.initDataUnsafe?.user;
        if (u?.id) setTelegramUser({ id: String(u.id) });
      }

      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab");
      const autoUser = urlParams.get("autouser");
      const autoRole = urlParams.get("autorole");
      const autoName = urlParams.get("autoname");
      const fileIdParam = urlParams.get("file_id");
      const fileNameParam = urlParams.get("fname");

      if (fileIdParam) {
        setIncomingTgFile({ fileId: fileIdParam, fileName: fileNameParam || "schedule.xlsx" });
      }

      if (autoUser && autoRole) {
        const autoSession = {
          username: autoUser,
          display_name: autoName || (autoRole === "superuser" ? "مدیر کل سامانه" : autoUser),
          role: autoRole,
          token: `${autoRole}-chat-sso`
        };
        sessionStorage.setItem("uni_auth_session", JSON.stringify(autoSession));
        setSession(autoSession);
        setActiveTab("admin");
      } else if (tabParam === "admin") {
        setActiveTab("admin");
      }
    } catch {}

    const cleanUrl = apiUrl.replace(/\/$/, "");
    fetch(`${cleanUrl}/api/classes?day=all`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setClasses(data);
          localStorage.setItem("uni_cached_classes_v2", JSON.stringify(data));
        }
      })
      .catch(() => {});

    return () => clearInterval(timer);
  }, [apiUrl]);

  const handleSecretLogoTap = () => {
    const next = logoTaps + 1;
    setLogoTaps(next);
    if (next >= 5) {
      setLogoTaps(0);
      setActiveTab("admin");
    }
  };

  const addAuditLog = (entry) => {
    const timestamp = new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "medium"
    }).format(new Date());

    const newLog = { ...entry, timestamp, uid: telegramUser.id };
    const updated = [newLog, ...auditLogs].slice(0, 100);
    setAuditLogs(updated);
    localStorage.setItem("uni_audit_logs", JSON.stringify(updated));
  };

  const handleUpdateSuperCreds = (newCreds) => {
    setSuperCreds(newCreds);
    localStorage.setItem("uni_super_creds", JSON.stringify(newCreds));
    const updatedSession = {
      ...session,
      username: newCreds.username,
      display_name: newCreds.display_name
    };
    setSession(updatedSession);
    sessionStorage.setItem("uni_auth_session", JSON.stringify(updatedSession));
    addAuditLog({
      actor: newCreds.display_name,
      username: newCreds.username,
      role: "superuser",
      action: "تغییر رمز سوپریوزر",
      details: `نام کاربری سوپریوزر به «${newCreds.username}» بروزرسانی شد.`
    });
  };

  const handleLogin = async (user, pass) => {
    const cleanUser = user.toLowerCase();

    if (
      (cleanUser === superCreds.username.toLowerCase() && pass === superCreds.password) ||
      (cleanUser === "admin" && pass === "admin1234" && superCreds.username === "admin")
    ) {
      const superSession = {
        username: superCreds.username,
        display_name: superCreds.display_name || "مدیر کل سامانه",
        role: "superuser",
        token: "super-token"
      };
      sessionStorage.setItem("uni_auth_session", JSON.stringify(superSession));
      setSession(superSession);
      addAuditLog({
        actor: superSession.display_name,
        username: superSession.username,
        role: "superuser",
        action: "ورود سوپریوزر",
        details: "ورود به پنل مدیریت کل"
      });
      return { ok: true };
    }

    const foundEditor = editors.find((e) => e.username.toLowerCase() === cleanUser && e.password === pass);
    if (foundEditor) {
      const editorSession = {
        username: foundEditor.username,
        display_name: foundEditor.display_name,
        role: "editor",
        token: `editor-${foundEditor.username}`
      };
      sessionStorage.setItem("uni_auth_session", JSON.stringify(editorSession));
      setSession(editorSession);
      addAuditLog({
        actor: foundEditor.display_name,
        username: foundEditor.username,
        role: "editor",
        action: "ورود ادیتور",
        details: `ورود «${foundEditor.display_name}» به بخش بارگذاری اکسل`
      });
      return { ok: true };
    }

    return { ok: false, error: "نام کاربری یا رمز عبور اشتباه است." };
  };

  const handleLogout = () => {
    sessionStorage.removeItem("uni_auth_session");
    setSession(null);
    setActiveTab("dashboard");
  };

  const notificationsList = useMemo(() => {
    return classes
      .filter((c) => Boolean(c.status_note))
      .map((c, idx) => ({
        id: c.id || idx,
        course_name: c.course_name,
        professor: c.professor,
        day: c.day,
        time: formatTimeSlotLabel(c.time),
        location: c.location,
        status_note: c.status_note,
        actor: c.updated_by || "مسئول آموزش"
      }));
  }, [classes]);

  const filteredClasses = useMemo(() => {
    const q = normalizeText(searchQuery);
    return classes.filter((c) => {
      const matchDay = selectedDay === "همه" || normalizeText(c.day) === selectedDay;
      const matchTime = matchesTimeSlot(c.time, timeSlot);

      let matchSearch = true;
      if (q) {
        const course = normalizeText(c.course_name);
        const prof = normalizeText(c.professor);
        const loc = normalizeText(c.location);
        if (searchMode === "course") matchSearch = course.includes(q);
        else if (searchMode === "prof") matchSearch = prof.includes(q);
        else if (searchMode === "loc") matchSearch = loc.includes(q);
        else matchSearch = course.includes(q) || prof.includes(q) || loc.includes(q);
      }

      return matchDay && matchTime && matchSearch;
    });
  }, [classes, selectedDay, timeSlot, searchQuery, searchMode]);

  const handleSaveSingleClass = async (e) => {
    e.preventDefault();
    const actorName = session?.display_name || "مدیریت";
    const itemToSave = {
      ...editingClass,
      id: editingClass.id || Date.now(),
      updated_by: actorName
    };

    const exists = classes.some((c) => c.id === itemToSave.id);
    const updated = exists
      ? classes.map((c) => (c.id === itemToSave.id ? itemToSave : c))
      : [itemToSave, ...classes];

    setClasses(updated);
    localStorage.setItem("uni_cached_classes_v2", JSON.stringify(updated));

    if (session) {
      addAuditLog({
        actor: actorName,
        username: session.username,
        role: session.role,
        action: itemToSave.status_note ? `اعلام وضعیت: ${itemToSave.status_note}` : "ویرایش کلاس",
        details: `درس «${itemToSave.course_name}» (${itemToSave.day} - کلاس ${itemToSave.location}) توسط ${actorName} ثبت شد.`
      });
    }

    try {
      const cleanUrl = apiUrl.replace(/\/$/, "");
      await fetch(`${cleanUrl}/api/classes/single`, {
        method: exists ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemToSave)
      });
    } catch {}

    setEditingClass(null);
  };

  const handleDeleteClass = async (cls) => {
    const actorName = session?.display_name || "مدیریت";

    const updated = classes.filter((c) => {
      if (cls.id !== undefined && c.id !== undefined && c.id === cls.id) {
        return false;
      }
      const sameSignature =
        normalizeText(c.course_name) === normalizeText(cls.course_name) &&
        normalizeText(c.professor) === normalizeText(cls.professor) &&
        normalizeText(c.day) === normalizeText(cls.day) &&
        normalizeText(c.time) === normalizeText(cls.time) &&
        normalizeText(c.location) === normalizeText(cls.location);
      return !sameSignature;
    });

    setClasses(updated);
    localStorage.setItem("uni_cached_classes_v2", JSON.stringify(updated));

    if (session) {
      addAuditLog({
        actor: actorName,
        username: session.username,
        role: session.role,
        action: "حذف کلاس",
        details: `درس «${cls.course_name}» استاد ${cls.professor} (${cls.day}) توسط ${actorName} حذف شد.`
      });
    }

    try {
      const cleanUrl = apiUrl.replace(/\/$/, "");
      await fetch(`${cleanUrl}/api/classes/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cls.id,
          course_name: cls.course_name,
          professor: cls.professor,
          day: cls.day,
          time: cls.time,
          actor: actorName,
          username: session?.username || "admin",
          uid: telegramUser.id
        })
      });
    } catch {}
  };

  return (
    <div className="app-wrapper">
      <header className="top-header">
        <div className="header-brand-side" onClick={handleSecretLogoTap}>
          <div className="neu-sq-btn">
            <IconCap size={24} />
          </div>
          <div>
            <div className="brand-title-row">
              <span>UniClass</span>
              <span style={{ color: "var(--accent)" }}>•</span>
              <span style={{ fontSize: "13.5px", color: "var(--accent)" }}>پرتال دانشجویی</span>
            </div>
            <p className="brand-subtitle">سامانه هوشمند برنامه و مکان برگزاری کلاس‌ها</p>
          </div>
        </div>

        <button
          className={`neu-sq-btn ${activeTab === "notifications" ? "active" : ""}`}
          onClick={() => setActiveTab(activeTab === "notifications" ? "dashboard" : "notifications")}
          title="اعلان تغییرات کلاس‌ها"
        >
          <IconBell size={21} />
          {notificationsList.length > 0 && (
            <span className="bell-badge-count">{notificationsList.length}</span>
          )}
        </button>
      </header>

      {activeTab === "dashboard" && (
        <section className="neu-card card-row-between">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="neu-icon-box">
              <IconCalendar size={22} />
            </div>
            <div>
              <div className="date-label">تقویم دانشگاهی امروز</div>
              <div className="date-value">{jalaliDate}</div>
            </div>
          </div>
          <div className="clock-digits">{nowTime}</div>
        </section>
      )}

      {activeTab === "notifications" && (
        <section className="neu-card">
          <div className="card-row-between" style={{ marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "15.5px" }}>اطلاع‌رسانی تغییرات و کلاس‌های جبرانی</h3>
            <span className="role-badge">{notificationsList.length} اطلاعیه</span>
          </div>

          {notificationsList.length === 0 ? (
            <p style={{ fontSize: "12.5px", color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>
              در حال حاضر هیچ تغییر یا لغو کلاسی ثبت نشده است.
            </p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {notificationsList.map((n) => (
                <div key={n.id} className="neu-inset-box">
                  <div className="card-row-between" style={{ marginBottom: "6px" }}>
                    <strong style={{ fontSize: "14px" }}>{n.course_name}</strong>
                    <span
                      className="role-badge"
                      style={{
                        background: n.status_note.includes("لغو") ? "rgba(225,29,72,0.15)" : "var(--accent-soft)",
                        color: n.status_note.includes("لغو") ? "#e11d48" : "var(--accent)"
                      }}
                    >
                      {n.status_note}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 6px 0", fontSize: "12.5px", lineHeight: 1.6 }}>
                    کلاس استاد <strong>{n.professor}</strong> در روز <strong>{n.day}</strong> (ساعت {n.time} - کلاس {n.location}) توسط <strong>«{n.actor}»</strong> به وضعیت <strong>«{n.status_note}»</strong> تغییر یافت.
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "themes" && (
        <ThemeSelector currentThemeId={themeId} onSelectTheme={setThemeId} />
      )}

      {activeTab === "admin" && (
        <AdminPanel
          session={session}
          onLogin={handleLogin}
          onLogout={handleLogout}
          apiUrl={apiUrl}
          setApiUrl={setApiUrl}
          classes={classes}
          setClasses={(newList) => {
            setClasses(newList);
            localStorage.setItem("uni_cached_classes_v2", JSON.stringify(newList));
          }}
          telegramUser={telegramUser}
          incomingTgFile={incomingTgFile}
          onClearIncomingFile={() => setIncomingTgFile(null)}
          onOpenQuickAdd={() =>
            setEditingClass({
              day: selectedDay === "همه" ? "شنبه" : selectedDay,
              course_name: "",
              professor: "",
              time: "08:00-10:00",
              location: "",
              building: "ساختمان سردار سلیمانی",
              group_num: "1",
              week_type: "هر هفته",
              status_note: "کلاس جبرانی"
            })
          }
          auditLogs={auditLogs}
          addAuditLog={addAuditLog}
          editors={editors}
          setEditors={(edList) => {
            setEditors(edList);
            localStorage.setItem("uni_editors_list_v2", JSON.stringify(edList));
          }}
          superCreds={superCreds}
          onUpdateSuperCreds={handleUpdateSuperCreds}
        />
      )}

      {(activeTab === "dashboard" || activeTab === "search") && (
        <section>
          <div className="chips-scroll-row">
            {DAYS.map((day) => (
              <button
                key={day}
                className={`neu-pill-btn ${selectedDay === day ? "active" : ""}`}
                onClick={() => setSelectedDay(day)}
              >
                {day === "همه" ? "کل هفته" : day}
              </button>
            ))}
          </div>

          <div className="search-bar-flex">
            <span style={{ color: "var(--accent)", display: "flex", paddingRight: "4px" }}>
              <IconSearch size={19} />
            </span>
            <input
              type="text"
              className="search-bar-input"
              placeholder="جستجوی نام درس، استاد یا شماره کلاس..."
              value={searchQuery}
              onChange={(e) => {
                if (e.target.value.trim().toLowerCase() === "#admin") {
                  setSearchQuery("");
                  setActiveTab("admin");
                  return;
                }
                setSearchQuery(e.target.value);
              }}
            />
            {searchQuery && (
              <button className="neu-pill-btn" style={{ padding: "5px 10px" }} onClick={() => setSearchQuery("")}>
                پاک کردن
              </button>
            )}
          </div>

          <div className="chips-scroll-row">
            <select
              className="neu-pill-btn"
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label}
                </option>
              ))}
            </select>

            {[
              { id: "all", label: "همه فیلدها" },
              { id: "course", label: "فقط نام درس" },
              { id: "prof", label: "فقط استاد" },
              { id: "loc", label: "فقط شماره کلاس" }
            ].map((m) => (
              <button
                key={m.id}
                className={`neu-pill-btn ${searchMode === m.id ? "active" : ""}`}
                onClick={() => setSearchMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: "6px" }}>
            {filteredClasses.length === 0 ? (
              <div className="neu-card" style={{ textAlign: "center", padding: "32px 16px" }}>
                <strong style={{ display: "block", marginBottom: "4px" }}>کلاسی ثبت نشده یا در این بازه وجود ندارد</strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  روز یا ساعت دیگری را انتخاب کنید.
                </span>
              </div>
            ) : (
              filteredClasses.map((c, idx) => (
                <article key={c.id || `${c.course_name}-${idx}`} className="class-item-card">
                  <div className="card-row-between">
                    <h3 className="course-name-title">{c.course_name}</h3>
                    {c.status_note && (
                      <span
                        className="role-badge"
                        style={{
                          background: c.status_note.includes("لغو") ? "rgba(225, 29, 72, 0.14)" : "var(--accent-soft)",
                          color: c.status_note.includes("لغو") ? "#e11d48" : "var(--accent)"
                        }}
                      >
                        {c.status_note} {c.updated_by ? `(${c.updated_by})` : ""}
                      </span>
                    )}
                  </div>

                  <div className="class-chips-wrap">
                    <button
                      className="interactive-chip"
                      onClick={() => {
                        setSearchMode("prof");
                        setSearchQuery(c.professor);
                      }}
                    >
                      <IconUser size={14} />
                      <span>{c.professor}</span>
                    </button>

                    <button
                      className="interactive-chip"
                      onClick={() => {
                        setSearchMode("loc");
                        setSearchQuery(c.location);
                      }}
                    >
                      <IconMapPin size={14} />
                      <span>کلاس {c.location} ({c.building || "سردار سلیمانی"})</span>
                    </button>

                    <span className="interactive-chip" style={{ color: "var(--accent)" }}>
                      <IconClock size={14} />
                      <span>ساعت {formatTimeSlotLabel(c.time)}</span>
                    </span>

                    <button className="interactive-chip" onClick={() => setSelectedDay(c.day)}>
                      <IconCalendar size={14} />
                      <span>{c.day} • {c.week_type}</span>
                    </button>
                  </div>

                  {session && (
                    <div className="card-row-between" style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed var(--border-col)" }}>
                      <button
                        className="interactive-chip"
                        style={{ color: "var(--accent)" }}
                        onClick={() => setEditingClass({ ...c })}
                      >
                        <IconEdit size={14} /> ویرایش / اعلام لغو یا جبرانی
                      </button>
                      <button
                        className="interactive-chip"
                        style={{ color: "#dc2626" }}
                        onClick={() => handleDeleteClass(c)}
                      >
                        <IconTrash size={14} /> حذف
                      </button>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {editingClass && (
        <div className="modal-overlay" onClick={() => setEditingClass(null)}>
          <div className="neu-card" style={{ width: "100%", maxWidth: "420px", margin: 0 }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ marginTop: 0 }}>ویرایش و اعلام وضعیت کلاس</h4>
            <form onSubmit={handleSaveSingleClass} className="admin-form-stack">
              <input
                type="text"
                className="neu-field"
                placeholder="نام درس..."
                value={editingClass.course_name}
                onChange={(e) => setEditingClass({ ...editingClass, course_name: e.target.value })}
                required
              />
              <div className="two-col-grid">
                <input
                  type="text"
                  className="neu-field"
                  placeholder="نام استاد..."
                  value={editingClass.professor}
                  onChange={(e) => setEditingClass({ ...editingClass, professor: e.target.value })}
                />
                <input
                  type="text"
                  className="neu-field"
                  placeholder="شماره کلاس..."
                  value={editingClass.location}
                  onChange={(e) => setEditingClass({ ...editingClass, location: e.target.value })}
                />
              </div>
              <div className="two-col-grid">
                <select
                  className="neu-field"
                  value={editingClass.day}
                  onChange={(e) => setEditingClass({ ...editingClass, day: e.target.value })}
                >
                  {DAYS.filter((d) => d !== "همه").map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  className="neu-field"
                  value={editingClass.time}
                  onChange={(e) => setEditingClass({ ...editingClass, time: e.target.value })}
                >
                  <option value="08:00-10:00">۸ تا ۱۰</option>
                  <option value="10:00-12:00">۱۰ تا ۱۲</option>
                  <option value="12:00-14:00">۱۲ تا ۱۴</option>
                  <option value="14:00-16:00">۱۴ تا ۱۶</option>
                  <option value="16:00-18:00">۱۶ تا ۱۸</option>
                  <option value="18:00-20:00">۱۸ تا ۲۰</option>
                </select>
              </div>
              <select
                className="neu-field"
                value={editingClass.status_note || ""}
                onChange={(e) => setEditingClass({ ...editingClass, status_note: e.target.value })}
              >
                <option value="">وضعیت عادی (برگزار می‌شود)</option>
                <option value="کلاس جبرانی">کلاس جبرانی</option>
                <option value="لغو شده">لغو شده (عدم تشکیل)</option>
                <option value="تغییر مکان کلاس">تغییر مکان کلاس</option>
              </select>
              <div className="two-col-grid">
                <button type="submit" className="accent-btn">ثبت و اطلاع‌رسانی در زنگوله</button>
                <button type="button" className="neu-pill-btn" style={{ justifyContent: "center" }} onClick={() => setEditingClass(null)}>
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RadialMenu
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasAdminAccess={Boolean(session)}
        unreadCount={notificationsList.length}
      />
    </div>
  );
}