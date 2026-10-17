import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { IconShield, IconUser, IconEdit, IconTrash } from "./Icons";

const DAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه شنبه", "چهارشنبه"];

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

function cleanTimeFormat(raw = "") {
  const norm = normalizeText(raw);
  const matches = norm.match(/\d{1,2}:\d{2}/g);
  if (matches && matches.length >= 2) {
    const pad = (t) => (t.length === 4 ? "0" + t : t);
    const t1 = pad(matches[0]);
    const t2 = pad(matches[1]);
    return t1 < t2 ? `${t1}-${t2}` : `${t2}-${t1}`;
  }
  return norm || "08:00-10:00";
}

// تشخیص خودکار روز هفته از نام فایل (مثلا chaharshanbeh -> چهارشنبه)
function detectDayFromFilename(fname = "") {
  const lower = fname.toLowerCase();
  if (lower.includes("chahar") || fname.includes("چهار")) return "چهارشنبه";
  if (lower.includes("se") || fname.includes("سه")) return "سه شنبه";
  if (lower.includes("do") || fname.includes("دو")) return "دوشنبه";
  if (lower.includes("yek") || fname.includes("یک")) return "یکشنبه";
  if (lower.includes("shanb") || fname.includes("شنبه")) return "شنبه";
  return null;
}

export default function AdminPanel({
  session,
  onLogin,
  onLogout,
  apiUrl,
  setApiUrl,
  classes,
  setClasses,
  telegramUser,
  incomingTgFile,
  onClearIncomingFile,
  onOpenQuickAdd,
  auditLogs,
  addAuditLog,
  editors,
  setEditors,
  superCreds,
  onUpdateSuperCreds
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [adminSubTab, setAdminSubTab] = useState("upload");

  const [editingOriginalUser, setEditingOriginalUser] = useState(null);
  const [newEditorName, setNewEditorName] = useState("");
  const [newEditorUser, setNewEditorUser] = useState("");
  const [newEditorPass, setNewEditorPass] = useState("");
  const [userMsg, setUserMsg] = useState("");

  const [superUserField, setSuperUserField] = useState(superCreds?.username || "admin");
  const [superPassField, setSuperPassField] = useState(superCreds?.password || "admin1234");
  const [superNameField, setSuperNameField] = useState(superCreds?.display_name || "مدیر سامانه");
  const [superMsg, setSuperMsg] = useState("");

  const [rawExcelData, setRawExcelData] = useState([]);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [colMap, setColMap] = useState({
    course: -1, prof: -1, day: -1, time: -1, loc: -1, building: -1, group: -1, week: -1
  });
  const [replaceMode, setReplaceMode] = useState("day");
  const [targetDay, setTargetDay] = useState("شنبه");
  const [uploadMsg, setUploadMsg] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (superCreds) {
      setSuperUserField(superCreds.username);
      setSuperPassField(superCreds.password);
      setSuperNameField(superCreds.display_name || "مدیر سامانه");
    }
  }, [superCreds]);

  // پردازش مشترک بافر یا باینری اکسل (چه از دکمه Choose File و چه خودکار از چت تلگرام)
  const parseWorkbookBuffer = (data, readType, fileNameLabel) => {
    try {
      const guessedDay = detectDayFromFilename(fileNameLabel);
      if (guessedDay) setTargetDay(guessedDay);

      const workbook = XLSX.read(data, { type: readType });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

      const HEADER_KEYWORDS = [
        "نام درس", "گروه", "استاد", "واحد", "ساعت", "زمان",
        "مکان", "کلاس", "ساختمان", "روز", "هفته", "تعداد دانشجو"
      ];

      let bestRowIdx = 0;
      let maxScore = 0;

      for (let i = 0; i < Math.min(rows.length, 25); i++) {
        const rStr = rows[i].map(normalizeText);
        const nonEmptyCells = rStr.filter((c) => c.length > 0 && c.length < 40);
        if (nonEmptyCells.length < 3) continue;

        let score = 0;
        rStr.forEach((cell) => {
          if (cell.length > 40) return;
          HEADER_KEYWORDS.forEach((kw) => {
            if (cell.includes(kw)) score += 2;
          });
        });

        if (score > maxScore) {
          maxScore = score;
          bestRowIdx = i;
        }
      }

      const rawHeaderRow = rows[bestRowIdx] || [];
      const dataRows = rows
        .slice(bestRowIdx + 1)
        .filter((r) => r.filter((c) => normalizeText(c) !== "").length >= 3);

      const maxCols = Math.max(
        rawHeaderRow.length,
        ...dataRows.slice(0, 10).map((r) => r.length)
      );

      const richHeaders = [];
      const detected = { course: -1, prof: -1, day: -1, time: -1, loc: -1, building: -1, group: -1, week: -1 };

      for (let colIdx = 0; colIdx < maxCols; colIdx++) {
        let hText = normalizeText(rawHeaderRow[colIdx]);
        if (!hText && bestRowIdx > 0) {
          const above = normalizeText(rows[bestRowIdx - 1]?.[colIdx]);
          if (above && above.length < 30 && !above.includes("توجه")) hText = above;
        }

        let sampleVal = "";
        for (let r = 0; r < Math.min(dataRows.length, 8); r++) {
          const cellVal = normalizeText(dataRows[r]?.[colIdx]);
          if (cellVal && !HEADER_KEYWORDS.includes(cellVal)) {
            sampleVal = cellVal.length > 22 ? cellVal.slice(0, 22) + "…" : cellVal;
            break;
          }
        }

        const title = hText || `ستون ${colIdx + 1}`;
        const fullLabel = sampleVal ? `${title} (نمونه: ${sampleVal})` : title;
        richHeaders.push({ index: colIdx, title, sample: sampleVal, label: fullLabel });

        if (title.includes("نام درس") || title === "درس" || title.includes("عنوان درس")) {
          detected.course = colIdx;
        } else if (title.includes("استاد") || title.includes("مدرس")) {
          detected.prof = colIdx;
        } else if (title.includes("روز")) {
          detected.day = colIdx;
        } else if (title.includes("ساعت") || title.includes("زمان") || /\d{1,2}:\d{2}/.test(sampleVal)) {
          if (detected.time === -1) detected.time = colIdx;
        } else if (title.includes("مکان") || title.includes("شماره کلاس") || title === "کلاس") {
          detected.loc = colIdx;
        } else if (title.includes("ساختمان")) {
          detected.building = colIdx;
        } else if (title.includes("گروه")) {
          detected.group = colIdx;
        } else if (title.includes("هفته") || sampleVal.includes("هر هفته") || sampleVal.includes("فرد") || sampleVal.includes("زوج")) {
          if (detected.week === -1) detected.week = colIdx;
        }
      }

      setExcelHeaders(richHeaders);
      setRawExcelData(dataRows);
      setColMap(detected);
      setUploadMsg(`✅ فایل «${fileNameLabel}» (${dataRows.length} کلاس) به صورت خودکار بارگذاری شد. دکمه ثبت نهایی را بزنید.`);
    } catch {
      setUploadMsg("❌ خطا در خواندن ساختار فایل اکسل.");
    }
  };

  // بارگذاری خودکار فایلی که ادمین در چت تلگرام فرستاده است!
  useEffect(() => {
    if (incomingTgFile?.fileId) {
      setUploadMsg(`⏳ در حال دریافت خودکار فایل «${incomingTgFile.fileName}» از چت تلگرام...`);
      const cleanUrl = apiUrl.replace(/\/$/, "");
      fetch(`${cleanUrl}/api/telegram-file?file_id=${encodeURIComponent(incomingTgFile.fileId)}`)
        .then((res) => {
          if (!res.ok) throw new Error("خطا در دریافت فایل از ربات");
          return res.arrayBuffer();
        })
        .then((buffer) => {
          parseWorkbookBuffer(new Uint8Array(buffer), "array", incomingTgFile.fileName);
          if (onClearIncomingFile) onClearIncomingFile();
        })
        .catch(() => {
          setUploadMsg("⚠️ دریافت خودکار از چت ناموفق بود؛ لطفاً فایل را از دکمه زیر انتخاب کنید.");
        });
    }
  }, [incomingTgFile, apiUrl]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthErr("");
    const res = await onLogin(username.trim(), password.trim());
    if (!res.ok) {
      setAuthErr(res.error || "نام کاربری یا رمز عبور اشتباه است.");
    } else {
      setUsername("");
      setPassword("");
    }
  };

  const handleSaveEditor = async (e) => {
    e.preventDefault();
    if (!newEditorUser.trim() || !newEditorPass.trim()) return;

    const cleanU = newEditorUser.trim().toLowerCase();
    const accountData = {
      id: Date.now(),
      username: cleanU,
      password: newEditorPass.trim(),
      display_name: newEditorName.trim() || cleanU,
      role: "editor",
      created_at: new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date())
    };

    const filtered = editors.filter(
      (u) => u.username !== cleanU && u.username !== editingOriginalUser
    );
    const updated = [accountData, ...filtered];
    setEditors(updated);
    localStorage.setItem("uni_editors_list", JSON.stringify(updated));

    addAuditLog({
      actor: session.display_name,
      username: session.username,
      role: session.role,
      action: editingOriginalUser ? "ویرایش اطلاعات ادیتور" : "تعریف کاربر ادیتور",
      details: `حساب «${accountData.display_name}» (${accountData.username}) ذخیره شد.`
    });

    setUserMsg(
      editingOriginalUser
        ? `✅ اطلاعات «${accountData.display_name}» بروزرسانی شد.`
        : `✅ حساب ادیتور «${accountData.display_name}» ساخته شد.`
    );
    setEditingOriginalUser(null);
    setNewEditorName("");
    setNewEditorUser("");
    setNewEditorPass("");
  };

  const startEditEditor = (ed) => {
    setEditingOriginalUser(ed.username);
    setNewEditorName(ed.display_name);
    setNewEditorUser(ed.username);
    setNewEditorPass(ed.password);
    setUserMsg(`✏️ در حال ویرایش حساب «${ed.display_name}»...`);
  };

  const handleDeleteEditor = async (targetUser) => {
    const updated = editors.filter((u) => u.username !== targetUser);
    setEditors(updated);
    localStorage.setItem("uni_editors_list", JSON.stringify(updated));
    addAuditLog({
      actor: session.display_name,
      username: session.username,
      role: session.role,
      action: "حذف ادیتور",
      details: `دسترسی کاربر «${targetUser}» حذف شد.`
    });
  };

  const handleSaveSuperCreds = (e) => {
    e.preventDefault();
    if (!superUserField.trim() || !superPassField.trim()) return;
    onUpdateSuperCreds({
      username: superUserField.trim().toLowerCase(),
      password: superPassField.trim(),
      display_name: superNameField.trim() || "مدیر سامانه"
    });
    setSuperMsg("✅ نام کاربری و رمز عبور سوپریوزر با موفقیت تغییر یافت.");
  };

  const handleExcelSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg("در حال تحلیل هوشمند سرستون‌های اکسل...");

    const reader = new FileReader();
    reader.onload = (evt) => {
      parseWorkbookBuffer(evt.target.result, "binary", file.name);
    };
    reader.readAsBinaryString(file);
  };

  const mappedExcelClasses = useMemo(() => {
    if (!rawExcelData.length || colMap.course === -1) return [];
    const list = [];
    rawExcelData.forEach((row, idx) => {
      const course = normalizeText(row[colMap.course]);
      if (!course || course.length < 2 || course.includes("نام درس") || course.includes("توجه:")) return;

      list.push({
        id: Date.now() + idx,
        day: colMap.day !== -1 && normalizeText(row[colMap.day]) ? normalizeText(row[colMap.day]) : targetDay,
        course_name: course,
        professor: colMap.prof !== -1 && normalizeText(row[colMap.prof]) ? normalizeText(row[colMap.prof]) : "نامشخص",
        time: colMap.time !== -1 ? cleanTimeFormat(row[colMap.time]) : "08:00-10:00",
        location: colMap.loc !== -1 && normalizeText(row[colMap.loc]) ? normalizeText(row[colMap.loc]) : "نامشخص",
        building: colMap.building !== -1 && normalizeText(row[colMap.building]) ? normalizeText(row[colMap.building]) : "ساختمان سردار سلیمانی",
        group_num: colMap.group !== -1 && normalizeText(row[colMap.group]) ? normalizeText(row[colMap.group]) : "1",
        week_type: colMap.week !== -1 && normalizeText(row[colMap.week]) ? normalizeText(row[colMap.week]) : "هر هفته",
        status_note: "",
        updated_by: session?.display_name || "مدیریت"
      });
    });
    return list;
  }, [rawExcelData, colMap, targetDay, session]);

  const handleSaveExcel = async () => {
    if (!mappedExcelClasses.length) return;
    setIsUploading(true);

    // تشخیص روز واقعی از داخل ردیف‌های اکسل برای جایگزینی دقیق در دیتابیس
    const effectiveDay = mappedExcelClasses[0]?.day || targetDay;

    let updatedLocal = [...classes];
    if (replaceMode === "all") {
      updatedLocal = mappedExcelClasses;
    } else if (replaceMode === "day") {
      updatedLocal = [
        ...classes.filter((c) => normalizeText(c.day) !== normalizeText(effectiveDay)),
        ...mappedExcelClasses
      ];
    } else {
      updatedLocal = [...classes, ...mappedExcelClasses];
    }

    setClasses(updatedLocal);
    localStorage.setItem("uni_cached_classes", JSON.stringify(updatedLocal));

    addAuditLog({
      actor: session.display_name,
      username: session.username,
      role: session.role,
      action: "بارگذاری فایل اکسل",
      details: `${mappedExcelClasses.length} کلاس برای روز «${effectiveDay}» ثبت گردید.`
    });

    try {
      const cleanUrl = apiUrl.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/api/classes/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          replaceMode,
          dayToReplace: effectiveDay,
          classes: mappedExcelClasses,
          actor: session.display_name,
          username: session.username,
          uid: telegramUser.id
        })
      });
      if (!res.ok) throw new Error("Server error");
      setUploadMsg(`🎉 ${mappedExcelClasses.length} کلاس روز «${effectiveDay}» در مینی‌اپ و دکمه‌های چت ربات ثبت شد!`);
    } catch {
      setUploadMsg(`⚠️ در مینی‌اپ ذخیره شد، اما ارتباط با دیتابیس ربات برقرار نشد (آدرس سرور را در تب تنظیمات سرور بررسی کنید).`);
    } finally {
      setRawExcelData([]);
      setIsUploading(false);
    }
  };

  if (!session) {
    return (
      <section className="neu-card">
        <div className="card-row-between" style={{ marginBottom: "12px" }}>
          <div className="neu-icon-box">
            <IconShield size={22} />
          </div>
          <div style={{ textAlign: "right", flex: 1, marginRight: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "16px" }}>ورود به پرتال مدیریت</h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
              نام کاربری و رمز عبور خود را وارد نمایید
            </p>
          </div>
        </div>

        <form onSubmit={handleLoginSubmit} className="admin-form-stack">
          <input
            type="text"
            className="neu-field"
            placeholder="نام کاربری..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            className="neu-field"
            placeholder="رمز عبور..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {authErr && <div className="error-banner">{authErr}</div>}
          <button type="submit" className="accent-btn">
            ورود به پنل مدیریت
          </button>
        </form>
      </section>
    );
  }

  return (
    <div className="admin-stack">
      <section className="neu-card">
        <div className="card-row-between">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="neu-icon-box">
              <IconUser size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <strong style={{ fontSize: "14px" }}>{session.display_name}</strong>
                <span className="role-badge">
                  {session.role === "superuser" ? "سوپریوزر (مدیر کل)" : "ادیتور برنامه"}
                </span>
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                نام کاربری: {session.username}
              </span>
            </div>
          </div>

          <button className="neu-pill-btn" onClick={onLogout}>
            خروج
          </button>
        </div>

        {session.role === "superuser" && (
          <div className="chips-scroll-row" style={{ marginTop: "14px" }}>
            {[
              { id: "upload", label: "بارگذاری اکسل و تغییرات" },
              { id: "users", label: `مدیران و رمزها (${editors.length})` },
              { id: "logs", label: `لاگ فعالیت‌ها (${auditLogs.length})` },
              { id: "server", label: "تنظیمات سرور" }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`neu-pill-btn ${adminSubTab === tab.id ? "active" : ""}`}
                onClick={() => setAdminSubTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {(adminSubTab === "upload" || session.role !== "superuser") && (
        <section className="neu-card admin-form-stack">
          <div className="card-row-between">
            <h4 style={{ margin: 0, fontSize: "15px" }}>بارگذاری فایل اکسل و تغییرات هفتگی</h4>
            <button className="neu-pill-btn active" onClick={onOpenQuickAdd}>
              + ثبت کلاس جبرانی / تکی
            </button>
          </div>

          <div className="two-col-grid">
            <select className="neu-field" value={replaceMode} onChange={(e) => setReplaceMode(e.target.value)}>
              <option value="day">جایگزینی یک روز خاص</option>
              <option value="all">پاکسازی کل هفته و ثبت نو</option>
              <option value="append">افزودن به کلاس‌های فعلی</option>
            </select>

            <select className="neu-field" value={targetDay} onChange={(e) => setTargetDay(e.target.value)}>
              {DAYS.map((d) => (
                <option key={d} value={d}>روز پیش‌فرض: {d}</option>
              ))}
            </select>
          </div>

          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelSelect} className="neu-field" />

          {excelHeaders.length > 0 && (
            <div className="neu-inset-box">
              <strong style={{ fontSize: "12.5px", color: "var(--accent)", display: "block", marginBottom: "8px" }}>
                تطبیق هوشمند بر اساس نام سرستون‌های اکسل:
              </strong>
              {[
                { key: "course", label: "ستون نام درس:" },
                { key: "prof", label: "ستون نام استاد:" },
                { key: "time", label: "ستون ساعت:" },
                { key: "loc", label: "ستون شماره کلاس:" },
                { key: "building", label: "ستون ساختمان:" },
                { key: "day", label: "ستون روز هفته:" },
                { key: "week", label: "ستون زوج/فرد:" }
              ].map((f) => (
                <div key={f.key} className="card-row-between" style={{ padding: "5px 0", fontSize: "12px" }}>
                  <span style={{ whiteSpace: "nowrap" }}>{f.label}</span>
                  <select
                    className="neu-field"
                    style={{ width: "66%", padding: "7px 10px" }}
                    value={colMap[f.key]}
                    onChange={(e) => setColMap({ ...colMap, [f.key]: Number(e.target.value) })}
                  >
                    <option value={-1}>-- پیش‌فرض / انتخاب نشده --</option>
                    {excelHeaders.map((h) => (
                      <option key={h.index} value={h.index}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {uploadMsg && <div className="info-banner">{uploadMsg}</div>}

          <button
            className="accent-btn"
            disabled={!mappedExcelClasses.length || isUploading}
            onClick={handleSaveExcel}
          >
            {isUploading ? "در حال ثبت در دیتابیس..." : `ثبت نهایی ${mappedExcelClasses.length} کلاس در سامانه`}
          </button>
        </section>
      )}

      {session.role === "superuser" && adminSubTab === "users" && (
        <>
          <section className="neu-card admin-form-stack">
            <h4 style={{ margin: 0, fontSize: "15px" }}>
              {editingOriginalUser ? `ویرایش نام کاربری / رمز «${newEditorName}»` : "تعریف ادیتور جدید (مثلاً آقای صفری)"}
            </h4>

            <form onSubmit={handleSaveEditor} className="admin-form-stack">
              <input
                type="text"
                className="neu-field"
                placeholder="نام و عنوان (مثلاً آقای صفری)..."
                value={newEditorName}
                onChange={(e) => setNewEditorName(e.target.value)}
                required
              />
              <div className="two-col-grid">
                <input
                  type="text"
                  className="neu-field"
                  placeholder="نام کاربری (مثلاً safari)..."
                  value={newEditorUser}
                  onChange={(e) => setNewEditorUser(e.target.value)}
                  required
                />
                <input
                  type="text"
                  className="neu-field"
                  placeholder="رمز عبور جدید..."
                  value={newEditorPass}
                  onChange={(e) => setNewEditorPass(e.target.value)}
                  required
                />
              </div>
              {userMsg && <div className="info-banner">{userMsg}</div>}
              <div className="two-col-grid">
                <button type="submit" className="accent-btn">
                  {editingOriginalUser ? "ذخیره تغییرات کاربر" : "افزودن ادیتور"}
                </button>
                {editingOriginalUser && (
                  <button
                    type="button"
                    className="neu-pill-btn"
                    style={{ justifyContent: "center" }}
                    onClick={() => {
                      setEditingOriginalUser(null);
                      setNewEditorName("");
                      setNewEditorUser("");
                      setNewEditorPass("");
                      setUserMsg("");
                    }}
                  >
                    انصراف
                  </button>
                )}
              </div>
            </form>

            <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
              <strong style={{ fontSize: "13px" }}>لیست ادیتورها:</strong>
              {editors.map((ed) => (
                <div key={ed.username} className="neu-inset-box card-row-between">
                  <div>
                    <strong style={{ fontSize: "13.5px", display: "block" }}>{ed.display_name}</strong>
                    <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                      نام کاربری: <code>{ed.username}</code> | رمز فعلی: <code>{ed.password}</code>
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      className="neu-icon-box"
                      style={{ width: "36px", height: "36px" }}
                      onClick={() => startEditEditor(ed)}
                    >
                      <IconEdit size={16} />
                    </button>
                    <button
                      className="neu-icon-box"
                      style={{ color: "#dc2626", width: "36px", height: "36px" }}
                      onClick={() => handleDeleteEditor(ed.username)}
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="neu-card admin-form-stack">
            <h4 style={{ margin: 0, fontSize: "15px" }}>🔑 تغییر نام کاربری و رمز عبور سوپریوزر (حساب خودتان)</h4>
            <form onSubmit={handleSaveSuperCreds} className="admin-form-stack">
              <input
                type="text"
                className="neu-field"
                placeholder="عنوان نمایشی شما..."
                value={superNameField}
                onChange={(e) => setSuperNameField(e.target.value)}
                required
              />
              <div className="two-col-grid">
                <input
                  type="text"
                  className="neu-field"
                  placeholder="نام کاربری سوپریوزر..."
                  value={superUserField}
                  onChange={(e) => setSuperUserField(e.target.value)}
                  required
                />
                <input
                  type="text"
                  className="neu-field"
                  placeholder="رمز عبور جدید سوپریوزر..."
                  value={superPassField}
                  onChange={(e) => setSuperPassField(e.target.value)}
                  required
                />
              </div>
              {superMsg && <div className="info-banner">{superMsg}</div>}
              <button type="submit" className="accent-btn">
                بروزرسانی اطلاعات ورود سوپریوزر
              </button>
            </form>
          </section>
        </>
      )}

      {session.role === "superuser" && adminSubTab === "logs" && (
        <section className="neu-card admin-form-stack">
          <h4 style={{ margin: 0, fontSize: "15px" }}>لاگ ورود و بارگذاری‌ها</h4>
          <div style={{ display: "grid", gap: "8px", maxHeight: "360px", overflowY: "auto" }}>
            {auditLogs.length === 0 ? (
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>لاگی ثبت نشده است.</span>
            ) : (
              auditLogs.map((log, i) => (
                <div key={i} className="neu-inset-box" style={{ fontSize: "12px" }}>
                  <div className="card-row-between" style={{ marginBottom: "4px" }}>
                    <strong style={{ color: "var(--accent)" }}>
                      {log.actor} ({log.username})
                    </strong>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", direction: "ltr" }}>
                      {log.timestamp}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, marginBottom: "2px" }}>{log.action}</div>
                  <div style={{ color: "var(--text-muted)" }}>{log.details}</div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {session.role === "superuser" && adminSubTab === "server" && (
        <section className="neu-card admin-form-stack">
          <h4 style={{ margin: 0, fontSize: "15px" }}>آدرس بک‌اند کلودفلر (Worker URL)</h4>
          <input
            type="text"
            className="neu-field"
            style={{ direction: "ltr" }}
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
          />
          <button className="accent-btn" onClick={() => localStorage.setItem("uni_api_url", apiUrl)}>
            ذخیره آدرس سرور
          </button>
        </section>
      )}
    </div>
  );
}