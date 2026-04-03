CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  guests TEXT NOT NULL,
  area TEXT DEFAULT 'indoor',
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  table_number TEXT DEFAULT NULL,
  email_sent INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS media_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
