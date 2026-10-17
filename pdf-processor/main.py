from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
import re
import os
import tempfile
import json
from google import genai

app = FastAPI(title="Uni Class Parser - Dual Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 1. AI Engine (Gemini 3.8 Flash - Interactions API)
# ==========================================
GEMINI_API_KEY = "AQ.Ab8RN6JpFKJ_mSE36I2UWqLcrQ9VpBhfNUbm13wU8DrWok6sSA"
# مقداردهی دقیق کلاینت طبق رفرنس شما
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

def extract_json(text: str) -> list:
    try:
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        return []
    except Exception:
        return []

@app.post("/parse-ai")
async def process_pdf_ai(file: UploadFile = File(...)):
    if not client:
        raise HTTPException(status_code=500, detail="API Key تنظیم نشده است.")

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            contents = await file.read()
            tmp_file.write(contents)
            tmp_path = tmp_file.name

        # آپلود فایل به سرور
        uploaded_file = client.files.upload(file=tmp_path)
        
        prompt = """
        این فایل برنامه کلاسی دانشگاه است. یک آرایه JSON دقیق از کلاس‌ها استخراج کن. 
        کلیدها: day, course_name, professor, time (مثل 10:00-12:00), location, group_num, week_type.
        هیچ متن اضافه‌ای غیر از JSON تولید نکن.
        """

        # استفاده دقیق از ساختار interactions طبق رفرنس شما
        interaction = client.interactions.create(
            model="gemini-3.8-flash",
            input=[uploaded_file, prompt]
        )

        os.remove(tmp_path)
        
        classes_data = extract_json(interaction.output_text)
        return {"message": "استخراج AI", "total": len(classes_data), "data": classes_data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# 2. Local Engine (PyMuPDF - Spatial Sorting)
# ==========================================
def clean_persian_ligatures(text: str) -> str:
    """تلاش برای اصلاح چسبندگی حروف به هم ریخته در PDFهای غیراستاندارد"""
    if not text: return ""
    # حذف فاصله‌های نابجا در میان کلمات فارسی
    text = re.sub(r'(?<=[ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی])\s+(?=[ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی])', '', text)
    if re.search(r'[\u0600-\u06FF]', text):
        return text[::-1]
    return text

def extract_classes_local(pdf_bytes: bytes):
    classes = []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page in doc:
            current_day = "نامشخص"
            for d in ["شنبه", "یکشنبه", "دوشنبه", "سه شنبه", "چهارشنبه", "پنجشنبه"]:
                if d in page.get_text():
                    current_day = d
                    break

            # استخراج کلمات بر اساس مختصات دقیق (x, y) برای جلوگیری از پرش ستون‌ها
            words = page.get_text("words")
            words.sort(key=lambda w: (w[3], w[0]))  # مرتب‌سازی عمودی سپس افقی
            
            tabs = page.find_tables(strategy="lines_strict") 
            if not tabs.tables:
                tabs = page.find_tables(strategy="text")

            for table in tabs:
                rows = table.extract()
                if not rows or len(rows) < 2: continue

                for row in rows[1:]:
                    if not row or all(cell is None or cell.strip() == '' for cell in row): continue
                    
                    clean_row = [clean_persian_ligatures(str(cell)) if cell else "" for cell in row]
                    row_text = " | ".join(clean_row)
                    
                    time_match = re.search(r'(\d{1,2}:\d{2}.*?\d{1,2}:\d{2})', row_text)
                    if not time_match: continue
                        
                    time_str = re.sub(r'[^\d:\-]', '', time_match.group(1))
                    if len(time_str) > 4 and "-" not in time_str:
                        time_str = time_str[:5] + "-" + time_str[5:]

                    course_name, professor = "", ""
                    for cell in clean_row:
                        # فیلترهای دقیق‌تر برای نادیده گرفتن متون نامربوط
                        if len(cell) > 2 and not re.search(r'\d', cell) and cell not in ["هر هفته", "هفته های فرد", "هفته های زوج"]:
                            if not course_name: course_name = cell
                            elif not professor: professor = cell

                    week_type = "هر هفته"
                    if "فرد" in row_text: week_type = "هفته های فرد"
                    elif "زوج" in row_text: week_type = "هفته های زوج"

                    if course_name:
                        classes.append({
                            "day": current_day,
                            "course_name": course_name.strip(),
                            "professor": professor.strip() if professor else "نامشخص",
                            "time": time_str,
                            "location": "ثبت شده",
                            "group_num": "1",
                            "week_type": week_type
                        })
        return classes
    except Exception as e:
        print(f"Extraction Error: {e}")
        return None

@app.post("/parse-local")
async def process_pdf_local(file: UploadFile = File(...)):
    contents = await file.read()
    extracted_data = extract_classes_local(contents)

    if extracted_data is None:
        raise HTTPException(status_code=500, detail="خطای سرور در پردازش PDF")
    
    return {"message": "استخراج با موتور لوکال", "total": len(extracted_data), "data": extracted_data}