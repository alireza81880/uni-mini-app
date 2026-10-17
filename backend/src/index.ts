import * as XLSX from "xlsx";

export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  ADMIN_SECRET?: string;
}

const MINI_APP_URL = "https://bot.iranitak.ir";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function normalizePersian(str: any = ""): string {
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

function cleanTimeFormat(raw: any = ""): string {
  const norm = normalizePersian(raw);
  const matches = norm.match(/\d{1,2}:\d{2}/g);
  if (matches && matches.length >= 2) {
    const pad = (t: string) => (t.length === 4 ? "0" + t : t);
    const t1 = pad(matches[0]);
    const t2 = pad(matches[1]);
    return t1 < t2 ? `${t1}-${t2}` : `${t2}-${t1}`;
  }
  return norm || "08:00-10:00";
}

function detectDayFromFilename(fname: string = ""): string {
  const lower = fname.toLowerCase();
  if (lower.includes("chahar") || fname.includes("چهار")) return "چهارشنبه";
  if (lower.includes("se") || fname.includes("سه")) return "سه شنبه";
  if (lower.includes("do") || fname.includes("دو")) return "دوشنبه";
  if (lower.includes("yek") || fname.includes("یک")) return "یکشنبه";
  if (lower.includes("shanb") || fname.includes("شنبه")) return "شنبه";
  return "شنبه";
}

// استخراج هوشمند کلاس‌ها از بافر اکسل مستقیماً در سمت سرور
function parseExcelBufferServerSide(buffer: ArrayBuffer, fileName: string, actor: string) {
  const defaultDay = detectDayFromFilename(fileName);
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

  const HEADER_KEYWORDS = ["نام درس", "گروه", "استاد", "واحد", "ساعت", "زمان", "مکان", "کلاس", "ساختمان", "روز", "هفته"];
  let bestRowIdx = 0;
  let maxScore = 0;

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const rStr = rows[i].map(normalizePersian);
    const nonEmpty = rStr.filter((c) => c.length > 0 && c.length < 40);
    if (nonEmpty.length < 3) continue;

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

  const headerRow = (rows[bestRowIdx] || []).map(normalizePersian);
  const dataRows = rows.slice(bestRowIdx + 1).filter((r) => r.filter((c) => normalizePersian(c) !== "").length >= 3);

  const colMap = { course: -1, prof: -1, day: -1, time: -1, loc: -1, building: -1, group: -1, week: -1 };
  headerRow.forEach((title, idx) => {
    if (title.includes("نام درس") || title === "درس") colMap.course = idx;
    else if (title.includes("استاد") || title.includes("مدرس")) colMap.prof = idx;
    else if (title.includes("روز")) colMap.day = idx;
    else if (title.includes("ساعت") || title.includes("زمان")) colMap.time = idx;
    else if (title.includes("مکان") || title.includes("شماره کلاس") || title === "کلاس") colMap.loc = idx;
    else if (title.includes("ساختمان")) colMap.building = idx;
    else if (title.includes("گروه")) colMap.group = idx;
    else if (title.includes("هفته")) colMap.week = idx;
  });

  if (colMap.course === -1) colMap.course = 1;
  if (colMap.prof === -1) colMap.prof = 4;
  if (colMap.week === -1) colMap.week = 5;
  if (colMap.day === -1) colMap.day = 6;
  if (colMap.time === -1) colMap.time = 7;
  if (colMap.loc === -1) colMap.loc = 8;
  if (colMap.building === -1) colMap.building = 9;

  const extracted = [];
  for (const row of dataRows) {
    const course = normalizePersian(row[colMap.course]);
    if (!course || course.length < 2 || course.includes("نام درس") || course.includes("توجه:")) continue;

    extracted.push({
      day: colMap.day !== -1 && normalizePersian(row[colMap.day]) ? normalizePersian(row[colMap.day]) : defaultDay,
      course_name: course,
      professor: colMap.prof !== -1 && normalizePersian(row[colMap.prof]) ? normalizePersian(row[colMap.prof]) : "نامشخص",
      time: colMap.time !== -1 ? cleanTimeFormat(row[colMap.time]) : "08:00-10:00",
      location: colMap.loc !== -1 && normalizePersian(row[colMap.loc]) ? normalizePersian(row[colMap.loc]) : "نامشخص",
      building: colMap.building !== -1 && normalizePersian(row[colMap.building]) ? normalizePersian(row[colMap.building]) : "ساختمان سردار سلیمانی",
      group_num: colMap.group !== -1 && normalizePersian(row[colMap.group]) ? normalizePersian(row[colMap.group]) : "1",
      week_type: colMap.week !== -1 && normalizePersian(row[colMap.week]) ? normalizePersian(row[colMap.week]) : "هر هفته",
      status_note: "",
      updated_by: actor
    });
  }
  return { day: extracted[0]?.day || defaultDay, classes: extracted };
}

async function initTables(env: Env) {
  if (!env.DB) return;
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT, course_name TEXT, professor TEXT, time TEXT,
        location TEXT, building TEXT, group_num TEXT, week_type TEXT,
        status_note TEXT DEFAULT '', updated_by TEXT DEFAULT ''
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT,
        display_name TEXT,
        role TEXT DEFAULT 'editor',
        created_at TEXT
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        actor TEXT,
        role TEXT,
        uid TEXT,
        action TEXT,
        details TEXT,
        timestamp TEXT
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        chat_id TEXT PRIMARY KEY,
        step TEXT,
        temp_user TEXT,
        logged_user TEXT,
        role TEXT
      )
    `)
  ]);

  // ارتقای خودکار جدول‌های قدیمی که ستون‌های status_note و updated_by را نداشتند (رفع خطای ذخیره در دیتابیس)
  try { await env.DB.prepare("ALTER TABLE classes ADD COLUMN status_note TEXT DEFAULT ''").run(); } catch {}
  try { await env.DB.prepare("ALTER TABLE classes ADD COLUMN updated_by TEXT DEFAULT ''").run(); } catch {}
}

async function logActivity(env: Env, username: string, actor: string, role: string, uid: string, action: string, details: string) {
  if (!env.DB) return;
  const now = new Date().toLocaleString("fa-IR", { timeZone: "Asia/Tehran" });
  await env.DB.prepare(
    "INSERT INTO audit_logs (username, actor, role, uid, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(username, actor, role, uid, action, details, now).run();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const workerOrigin = url.origin;

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    await initTables(env);

    // ۱. دریافت فایل اکسل تلگرام برای مینی‌اپ
    if (url.pathname === "/api/telegram-file" && request.method === "GET") {
      const fileId = url.searchParams.get("file_id");
      if (!fileId) return new Response(JSON.stringify({ error: "No file_id" }), { status: 400, headers: corsHeaders });
      try {
        const infoRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
        const infoData: any = await infoRes.json();
        const filePath = infoData?.result?.file_path;
        const fileRes = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${filePath}`);
        return new Response(await fileRes.arrayBuffer(), {
          headers: { "Content-Type": "application/octet-stream", ...corsHeaders }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // ۲. دریافت لیست کلاس‌ها
    if (url.pathname === "/api/classes" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM classes ORDER BY day, time ASC").all();
      return new Response(JSON.stringify(results || []), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // ۳. حذف کلاس
    if (url.pathname === "/api/classes/delete" && request.method === "POST") {
      const body: any = await request.json();
      if (body.id) {
        await env.DB.prepare("DELETE FROM classes WHERE id = ?").bind(body.id).run();
      }
      if (body.course_name && body.day) {
        await env.DB.prepare("DELETE FROM classes WHERE course_name = ? AND day = ? AND professor = ?")
          .bind(normalizePersian(body.course_name), normalizePersian(body.day), normalizePersian(body.professor || ""))
          .run();
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // ۴. افزودن یا ویرایش تکی کلاس
    if (url.pathname === "/api/classes/single" && (request.method === "POST" || request.method === "PUT")) {
      const c: any = await request.json();
      if (request.method === "PUT" && c.id) {
        await env.DB.prepare(
          "UPDATE classes SET day=?, course_name=?, professor=?, time=?, location=?, building=?, status_note=?, updated_by=? WHERE id=?"
        ).bind(
          normalizePersian(c.day),
          normalizePersian(c.course_name),
          normalizePersian(c.professor),
          normalizePersian(c.time),
          normalizePersian(c.location),
          normalizePersian(c.building || "ساختمان سردار سلیمانی"),
          normalizePersian(c.status_note || ""),
          normalizePersian(c.updated_by || "مدیریت"),
          c.id
        ).run();
      } else {
        await env.DB.prepare(
          "INSERT INTO classes (day, course_name, professor, time, location, building, group_num, week_type, status_note, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          normalizePersian(c.day),
          normalizePersian(c.course_name),
          normalizePersian(c.professor),
          normalizePersian(c.time),
          normalizePersian(c.location),
          normalizePersian(c.building || "ساختمان سردار سلیمانی"),
          normalizePersian(c.group_num || "1"),
          normalizePersian(c.week_type || "هر هفته"),
          normalizePersian(c.status_note || ""),
          normalizePersian(c.updated_by || "مدیریت")
        ).run();
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // ۵. ثبت دسته‌ای اکسل از مینی‌اپ
    if (url.pathname === "/api/classes/batch" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const { replaceMode, dayToReplace, classes, actor, username, uid } = body;

        const statements = [];
        if (replaceMode === "all") {
          statements.push(env.DB.prepare("DELETE FROM classes"));
        } else if (replaceMode === "day" && dayToReplace) {
          statements.push(env.DB.prepare("DELETE FROM classes WHERE day = ?").bind(normalizePersian(dayToReplace)));
        }

        const insertStmt = env.DB.prepare(
          "INSERT INTO classes (day, course_name, professor, time, location, building, group_num, week_type, status_note, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );

        for (const c of classes) {
          statements.push(
            insertStmt.bind(
              normalizePersian(c.day || dayToReplace || "شنبه"),
              normalizePersian(c.course_name),
              normalizePersian(c.professor || "نامشخص"),
              normalizePersian(c.time || "08:00-10:00"),
              normalizePersian(c.location || "نامشخص"),
              normalizePersian(c.building || "ساختمان سردار سلیمانی"),
              normalizePersian(c.group_num || "1"),
              normalizePersian(c.week_type || "هر هفته"),
              normalizePersian(c.status_note || ""),
              normalizePersian(actor || "مدیریت")
            )
          );
        }

        for (let i = 0; i < statements.length; i += 40) {
          await env.DB.batch(statements.slice(i, i + 40));
        }

        await logActivity(env, username || "admin", actor || "مدیریت", "editor", String(uid || "Web"), "بارگذاری اکسل", `${classes.length} کلاس ثبت شد.`);
        return new Response(JSON.stringify({ ok: true, count: classes.length }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    // ۶. وب‌هوک ربات تلگرام
    if (request.method === "POST") {
      try {
        const update: any = await request.json();
        const appUrlWithApi = `${MINI_APP_URL}/?api=${encodeURIComponent(workerOrigin)}&v=11`;

        const mainInlineMenu = {
          inline_keyboard: [
            [{ text: "🎓 ورود به پرتال دانشجویی کلاس‌یاب", web_app: { url: appUrlWithApi } }],
            [
              { text: "📅 شنبه", callback_data: "day:شنبه" },
              { text: "📅 یکشنبه", callback_data: "day:یکشنبه" },
              { text: "📅 دوشنبه", callback_data: "day:دوشنبه" }
            ],
            [
              { text: "📅 سه شنبه", callback_data: "day:سه شنبه" },
              { text: "📅 چهارشنبه", callback_data: "day:چهارشنبه" }
            ],
            [{ text: "🔄 منوی اصلی / استارت مجدد", callback_data: "menu:home" }]
          ]
        };

        const persistentReplyKeyboard = {
          keyboard: [[{ text: "🔄 منوی اصلی / استارت مجدد" }]],
          resize_keyboard: true,
          is_persistent: true
        };

        if (update.callback_query) {
          const cb = update.callback_query;
          const chatId = String(cb.message.chat.id);
          const data = cb.data || "";

          if (data === "menu:home") {
            await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `🎓 *منوی اصلی سامانه هوشمند کلاس‌یاب*\n\n🔹 نام *درس*، *استاد* یا *شماره کلاس* را تایپ کنید یا روز مورد نظر را انتخاب نمایید:`,
                parse_mode: "Markdown",
                reply_markup: mainInlineMenu
              })
            });
            return new Response("OK");
          }

          if (data.startsWith("day:")) {
            const selectedDay = normalizePersian(data.replace("day:", ""));
            const { results } = await env.DB.prepare("SELECT * FROM classes WHERE day = ? ORDER BY time ASC LIMIT 40")
              .bind(selectedDay)
              .all();

            let reply = `📅 *کلاس‌های روز ${selectedDay}:*\n\n`;
            if (!results || results.length === 0) {
              reply = `📭 برای روز *${selectedDay}* کلاسی ثبت نشده است.`;
            } else {
              reply += results
                .map((r: any) => `🔹 *${r.course_name}*${r.status_note ? `(${r.status_note})` : ""}\n👨‍🏫 ${r.professor} | ⏰ \`${r.time}\` | 🚪 کلاس ${r.location}`)
                .join("\n────────────\n");
            }

            await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: "Markdown", reply_markup: mainInlineMenu })
            });
          }
          return new Response("OK");
        }

        const msg = update.message;
        if (!msg) return new Response("OK");

        const chatId = String(msg.chat.id);
        const uid = String(msg.from?.id || chatId);
        const text = normalizePersian(msg.text || "");

        const sendTelegram = async (replyText: string, keyboard?: any) => {
          await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: replyText, parse_mode: "Markdown", reply_markup: keyboard })
          });
        };

        const chatState: any = await env.DB.prepare("SELECT * FROM chat_sessions WHERE chat_id = ?").bind(chatId).first();

        if (text === "/start" || text.includes("منوی اصلی") || text.includes("استارت مجدد")) {
          await env.DB.prepare("DELETE FROM chat_sessions WHERE chat_id = ?").bind(chatId).run();

          // حذف دکمه منوی خراب کنار کادر پیام در گوشی (تبدیل به حالت استاندارد commands)
          await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setChatMenuButton`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              menu_button: { type: "default" }
            })
          });

          await sendTelegram("🔄 دسترسی سریع:", persistentReplyKeyboard);
          await sendTelegram(
            `سلام 👋\nبه *سامانه هوشمند کلاس‌یاب دانشگاه* خوش آمدید.\n\n🔹 می‌توانید *نام درس*، *نام استاد* یا *شماره کلاس* را همین‌جا تایپ کنید.\n🔹 یا از دکمه‌های زیر روز مورد نظر را انتخاب نمایید:`,
            mainInlineMenu
          );
          return new Response("OK");
        }

        if (text === "/id") {
          await sendTelegram(`🆔 شناسه کاربری (UID): \`${uid}\``, mainInlineMenu);
          return new Response("OK");
        }

        if (text === "/login") {
          await env.DB.prepare(
            "INSERT OR REPLACE INTO chat_sessions (chat_id, step, temp_user, logged_user, role) VALUES (?, 'awaiting_user', '', '', '')"
          ).bind(chatId).run();
          await sendTelegram(`🔐 *ورود مدیریت*\nلطفاً *نام کاربری* خود را ارسال کنید:`);
          return new Response("OK");
        }

        if (chatState?.step === "awaiting_user" && text) {
          await env.DB.prepare("UPDATE chat_sessions SET step = 'awaiting_pass', temp_user = ? WHERE chat_id = ?")
            .bind(text.toLowerCase(), chatId)
            .run();
          await sendTelegram(`👤 نام کاربری «\`${text}\`» دریافت شد.\nاکنون *رمز عبور* خود را ارسال کنید:`);
          return new Response("OK");
        }

        if (chatState?.step === "awaiting_pass" && text) {
          const uname = chatState.temp_user;
          const superPass = env.ADMIN_SECRET || "admin1234";
          let validRole = "";
          let displayName = "";

          if (uname === "admin" && text === superPass) {
            validRole = "superuser";
            displayName = "مدیر کل";
          } else {
            const uRow: any = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND password = ?")
              .bind(uname, text)
              .first();
            if (uRow) {
              validRole = "editor";
              displayName = uRow.display_name;
            }
          }

          if (!validRole) {
            await env.DB.prepare("DELETE FROM chat_sessions WHERE chat_id = ?").bind(chatId).run();
            await sendTelegram("❌ نام کاربری یا رمز عبور اشتباه است. برای تلاش مجدد /login را ارسال کنید.");
            return new Response("OK");
          }

          await env.DB.prepare("UPDATE chat_sessions SET step = 'awaiting_excel', logged_user = ?, role = ? WHERE chat_id = ?")
            .bind(uname, validRole, chatId)
            .run();

          const ssoUrl = `${MINI_APP_URL}/?tab=admin&autouser=${encodeURIComponent(uname)}&autorole=${encodeURIComponent(validRole)}&autoname=${encodeURIComponent(displayName)}&api=${encodeURIComponent(workerOrigin)}&v=11`;

          await sendTelegram(
            `✅ خوش آمدید *${displayName}*!\n\n📎 اکنون کافیست *فایل اکسل را همین‌جا در چت بفرستید* تا مستقیماً در دیتابیس ربات و مینی‌اپ ذخیره شود!`,
            {
              inline_keyboard: [
                [{ text: "📥 باز کردن پنل مدیریت در مینی‌اپ", web_app: { url: ssoUrl } }],
                [{ text: "🔄 بازگشت به منوی اصلی", callback_data: "menu:home" }]
              ]
            }
          );
          return new Response("OK");
        }

        // پردازش و ذخیره مستقیم فایل اکسل در دیتابیس D1 به محض ارسال در چت تلگرام!
        if (msg.document && chatState?.step === "awaiting_excel") {
          const fileName = msg.document.file_name || "schedule.xlsx";
          const fileId = msg.document.file_id;
          const uname = chatState.logged_user || "admin";
          const urole = chatState.role || "superuser";

          try {
            const infoRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
            const infoData: any = await infoRes.json();
            const filePath = infoData?.result?.file_path;
            const fileRes = await fetch(`https://api.telegram.org/file/bot${env.BOT_TOKEN}/${filePath}`);
            const buffer = await fileRes.arrayBuffer();

            const parsed = parseExcelBufferServerSide(buffer, fileName, uname);

            if (parsed.classes.length > 0) {
              const statements = [
                env.DB.prepare("DELETE FROM classes WHERE day = ?").bind(normalizePersian(parsed.day))
              ];

              const insertStmt = env.DB.prepare(
                "INSERT INTO classes (day, course_name, professor, time, location, building, group_num, week_type, status_note, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
              );

              for (const c of parsed.classes) {
                statements.push(
                  insertStmt.bind(c.day, c.course_name, c.professor, c.time, c.location, c.building, c.group_num, c.week_type, "", uname)
                );
              }

              for (let i = 0; i < statements.length; i += 40) {
                await env.DB.batch(statements.slice(i, i + 40));
              }

              await logActivity(env, uname, uname, urole, uid, "ثبت مستقیم اکسل در چت", `${parsed.classes.length} کلاس روز ${parsed.day} از فایل ${fileName} ثبت شد.`);

              const ssoWithFileUrl = `${MINI_APP_URL}/?tab=admin&autouser=${encodeURIComponent(uname)}&autorole=${encodeURIComponent(urole)}&file_id=${encodeURIComponent(fileId)}&fname=${encodeURIComponent(fileName)}&api=${encodeURIComponent(workerOrigin)}&v=11`;

              await sendTelegram(
                `🎉 *فایل «${fileName}» با موفقیت پردازش و در دیتابیس ثبت شد!*\n\n📅 روز تشخیص داده‌شده: *${parsed.day}*\n📚 تعداد کلاس‌های ثبت‌شده: *${parsed.classes.length} کلاس*\n\nاکنون کلاس‌ها در دکمه‌های چت ربات و داخل مینی‌اپ فعال هستند:`,
                {
                  inline_keyboard: [
                    [{ text: `📅 مشاهده کلاس‌های ${parsed.day} در چت`, callback_data: `day:${parsed.day}` }],
                    [{ text: "📊 بازبینی ستون‌ها در مینی‌اپ", web_app: { url: ssoWithFileUrl } }],
                    [{ text: "🔄 منوی اصلی", callback_data: "menu:home" }]
                  ]
                }
              );
              return new Response("OK");
            }
          } catch (e: any) {
            await sendTelegram(`❌ خطا در پردازش خودکار فایل در چت: ${e.message}`);
            return new Response("OK");
          }
        }

        // جستجوی متنی مستقیم در چت
        if (text && !text.startsWith("/")) {
          const { results } = await env.DB.prepare(
            "SELECT * FROM classes WHERE course_name LIKE ? OR professor LIKE ? OR location LIKE ? LIMIT 15"
          ).bind(`%${text}%`, `%${text}%`, `%${text}%`).all();

          let reply = `🔍 نتیجه جستجو برای «*${text}*»:\n\n📭 کلاسی با این مشخصات یافت نشد.`;
          if (results && results.length > 0) {
            reply =
              `🔍 نتایج یافت‌شده برای «*${text}*»:\n\n` +
              results
                .map((r: any) => `📚 *${r.course_name}* ${r.status_note ? `(${r.status_note})` : ""}\n👨‍🏫 استاد: ${r.professor}\n📅 ${r.day} (${r.week_type}) | ⏰ \`${r.time}\` | 🚪 کلاس ${r.location}`)
                .join("\n────────────\n");
          }

          await sendTelegram(reply, mainInlineMenu);
          return new Response("OK");
        }
      } catch {}
      return new Response("OK");
    }

    return new Response("UniClass Worker v11 Ready", { headers: corsHeaders });
  }
};