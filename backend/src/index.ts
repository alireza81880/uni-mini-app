export interface Env {
  DB: any;
  BOT_TOKEN: string;
  ADMIN_UID: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. API دریافت لیست کلاس‌ها برای مینی‌اپ
    if (request.method === "GET" && url.pathname === "/api/classes") {
      const day = url.searchParams.get("day") || "دوشنبه";
      const { results } = await env.DB.prepare(
        "SELECT * FROM classes WHERE day = ?"
      ).bind(day).all();
      
      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 2. API ذخیره اطلاعات توسط ادمین
    if (request.method === "POST" && url.pathname === "/api/upload") {
      const authUid = request.headers.get("X-Admin-UID");
      if (authUid !== env.ADMIN_UID) return new Response("Unauthorized", { status: 401 });

      const data: any[] = await request.json();
      const stmts = data.map(c => 
        env.DB.prepare(`
          INSERT INTO classes (day, course_name, professor, time, location, week_type, group_num)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(day, course_name, professor, group_num) 
          DO UPDATE SET time=excluded.time, location=excluded.location, week_type=excluded.week_type
        `).bind(c.day, c.course_name, c.professor, c.time, c.location, c.week_type, c.group_num)
      );
      
      await env.DB.batch(stmts);
      return new Response(JSON.stringify({ success: true }));
    }

    // 3. Webhook پیام‌های تلگرام
    if (request.method === "POST" && url.pathname === `/bot-webhook`) {
      const update = await request.json();
      
      if (update.message?.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;

        // --- بخش مدیریت دستور /start ---
        if (text === "/start") {
          await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "سلام! 👋\nبه سیستم هوشمند کلاس‌یاب خوش آمدید.\n\nبرای پیدا کردن کلاس خود، روی دکمه زیر کلیک کنید تا مینی‌اپ باز شود، و یا نام درس/استاد را همینجا تایپ کنید:",
              reply_markup: {
                inline_keyboard: [[
                  // آدرس فرانت‌اند شما دقیقاً در خط زیر قرار داده شده است
                  { text: "🏫 ورود به کلاس‌یاب", web_app: { url: "https://quitacbot.pages.dev/?v=4" } }
                ]]
              }
            })
          });
          return new Response("OK");
        }

        // --- جستجوی متنی (اگر پیام /start نبود) ---
        const { results } = await env.DB.prepare(
          "SELECT * FROM classes WHERE course_name LIKE ? OR professor LIKE ? LIMIT 3"
        ).bind(`%${text}%`, `%${text}%`).all();

        let reply = results.length > 0 ? "🔎 نتایج یافت شده:\n\n" : "❌ درسی با این نام یافت نشد.";
        results.forEach((c: any) => {
          reply += `📚 درس: ${c.course_name}\n👨‍🏫 استاد: ${c.professor}\n⏰ ساعت: ${c.time}\n🏢 مکان: ${c.location}\n---\n`;
        });

        await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: reply })
        });
      }
      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  }
};