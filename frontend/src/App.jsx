import { useEffect, useState } from 'react';

export default function App() {
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('loading'); // 'loading', 'empty', 'error', 'success'
  
  // ⚠️ آدرس بک‌اند کلودفلر خود را اینجا قرار دهید
  const API_URL = "https://uni-class-bot.quitacbot.workers.dev"; // این آدرس را با آدرس Worker خود چک کنید

  useEffect(() => {
    try {
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.expand(); 
        // تنظیم رنگ هدر مینی‌اپ هماهنگ با تلگرام
        window.Telegram.WebApp.setHeaderColor('secondary_bg_color');
      }
    } catch (e) {
      console.warn("Telegram API not ready");
    }

    fetch(`${API_URL}/api/classes?day=دوشنبه`)
      .then(res => {
        if (!res.ok) throw new Error("Server Error");
        return res.json();
      })
      .then(data => {
        if(Array.isArray(data)) {
          setClasses(data);
          setStatus(data.length === 0 ? 'empty' : 'success');
        }
      })
      .catch(err => {
        console.error(err);
        setStatus('error');
      });
  }, []);

  const filtered = classes.filter(c => 
    (c.course_name && c.course_name.includes(search)) || 
    (c.professor && c.professor.includes(search))
  );

  return (
    <div style={{ 
      fontFamily: 'Tahoma, sans-serif', 
      dir: 'rtl', 
      minHeight: '100vh', 
      backgroundColor: 'var(--tg-theme-secondary-bg-color, #f4f4f5)', 
      color: 'var(--tg-theme-text-color, #000000)'
    }}>
      
      {/* هدر و جستجوی چسبان */}
      <div style={{
        position: 'sticky',
        top: 0,
        backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        zIndex: 10
      }}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 'bold' }}>برنامه کلاسی امروز</h2>
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            placeholder="جستجوی درس یا استاد..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '12px 35px 12px 12px', 
              borderRadius: '12px', 
              border: 'none', 
              backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
              color: 'var(--tg-theme-text-color, #000)',
              fontSize: '15px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <span style={{ position: 'absolute', right: '12px', top: '12px', fontSize: '16px' }}>🔍</span>
        </div>
      </div>

      {/* محتوای اصلی */}
      <div style={{ padding: '16px' }}>
        
        {/* حالت بارگذاری */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
            <p>در حال دریافت اطلاعات...</p>
          </div>
        )}

        {/* حالت خطا */}
        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: '30px', backgroundColor: '#fee2e2', borderRadius: '16px', color: '#991b1b' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>خطا در ارتباط با سرور</p>
            <p style={{ fontSize: '13px', margin: '8px 0 0 0' }}>لطفاً اتصال اینترنت را بررسی کنید.</p>
          </div>
        )}

        {/* حالت خالی (Empty State گرافیکی) */}
        {status === 'empty' && (
          <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: 'var(--tg-theme-bg-color, #ffffff)', borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--tg-theme-text-color, #333)' }}>کلاسی یافت نشد</h3>
            <p style={{ margin: 0, color: 'var(--tg-theme-hint-color, #888)', fontSize: '14px', lineHeight: '1.6' }}>
              برای امروز هیچ کلاسی در سیستم ثبت نشده است و یا کلاس‌ها به حد نصاب نرسیده‌اند.
            </p>
          </div>
        )}

        {/* لیست کلاس‌ها */}
        {status === 'success' && filtered.map((c, index) => (
          <div key={index} style={{ 
            backgroundColor: 'var(--tg-theme-bg-color, #ffffff)', 
            padding: '16px', 
            borderRadius: '16px', 
            marginBottom: '12px', 
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            borderLeft: '4px solid #3b82f6'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: 'var(--tg-theme-text-color, #1f2937)' }}>
              📚 {c.course_name}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: 'var(--tg-theme-hint-color, #4b5563)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>👨‍🏫</span> <span>استاد: {c.professor}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🏢</span> <span>مکان: {c.location}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⏰</span> <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>{c.time}</span>
              </div>
            </div>
          </div>
        ))}
        
      </div>
    </div>
  );
}