CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT,
    course_name TEXT,
    professor TEXT,
    time TEXT,
    location TEXT,
    week_type TEXT,
    group_num TEXT,
    UNIQUE(day, course_name, professor, group_num)
);