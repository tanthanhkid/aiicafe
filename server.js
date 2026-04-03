const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

// Load .env manually (no dotenv dependency)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  });
}
loadEnv();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Uploads Setup ──
const uploadsDir = path.join(__dirname, 'assets', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, uploadsDir); },
  filename: function(req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, name + '_' + Date.now() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: function(req, file, cb) {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|mov/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('File type not allowed'));
  }
});

const mediaConfigPath = path.join(__dirname, 'data', 'media-config.json');
function readMediaConfig() {
  try { return JSON.parse(fs.readFileSync(mediaConfigPath, 'utf8')); }
  catch(e) { return {}; }
}
function writeMediaConfig(config) {
  fs.writeFileSync(mediaConfigPath, JSON.stringify(config, null, 2));
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/assets/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname), {
  index: 'index.html',
  extensions: ['html']
}));

// ── Database Setup ──
const db = new Database(path.join(__dirname, 'data', 'aiicafe.db'));
db.pragma('journal_mode = WAL');

db.exec(`
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
  )
`);

// ── Email Setup ──
let transporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
  // Verify connection
  transporter.verify().then(() => {
    console.log('Gmail SMTP connected successfully');
  }).catch(err => {
    console.error('Gmail SMTP connection failed:', err.message);
    console.log('Email notifications will be disabled. Check your GMAIL_USER and GMAIL_APP_PASSWORD in .env');
    transporter = null;
  });
} else {
  console.log('Gmail SMTP not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env to enable email notifications.');
}

// Send notification emails
async function sendBookingEmails(booking) {
  if (!transporter) return;

  const areaMap = { indoor: 'Trong nhà', outdoor: 'Ngoài trời', kids: 'Khu vui chơi trẻ em' };
  const areaText = areaMap[booking.area] || booking.area;

  // Email to admin
  const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
  try {
    await transporter.sendMail({
      from: `"AiiCafe Booking" <${process.env.GMAIL_USER}>`,
      to: adminEmail,
      subject: `[Đặt bàn mới] ${booking.name} - ${booking.date} ${booking.time}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#FDF8EE;border-radius:12px;overflow:hidden;">
          <div style="background:#0F1E44;padding:24px 32px;text-align:center;">
            <h1 style="color:#EFC14B;margin:0;font-size:24px;">Đặt bàn mới tại AiiCafe</h1>
          </div>
          <div style="padding:32px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#7A829A;width:140px;">Mã đặt bàn:</td><td style="padding:8px 0;font-weight:600;color:#0F1E44;">${booking.booking_id}</td></tr>
              <tr><td style="padding:8px 0;color:#7A829A;">Khách hàng:</td><td style="padding:8px 0;font-weight:600;color:#0F1E44;">${booking.name}</td></tr>
              <tr><td style="padding:8px 0;color:#7A829A;">Email:</td><td style="padding:8px 0;color:#0F1E44;">${booking.email || 'Không có'}</td></tr>
              <tr><td style="padding:8px 0;color:#7A829A;">Điện thoại:</td><td style="padding:8px 0;color:#0F1E44;">${booking.phone}</td></tr>
              <tr><td style="padding:8px 0;color:#7A829A;">Ngày:</td><td style="padding:8px 0;font-weight:600;color:#0F1E44;">${booking.date}</td></tr>
              <tr><td style="padding:8px 0;color:#7A829A;">Giờ:</td><td style="padding:8px 0;font-weight:600;color:#0F1E44;">${booking.time}</td></tr>
              <tr><td style="padding:8px 0;color:#7A829A;">Số khách:</td><td style="padding:8px 0;color:#0F1E44;">${booking.guests}</td></tr>
              <tr><td style="padding:8px 0;color:#7A829A;">Khu vực:</td><td style="padding:8px 0;color:#0F1E44;">${areaText}</td></tr>
              ${booking.note ? `<tr><td style="padding:8px 0;color:#7A829A;vertical-align:top;">Ghi chú:</td><td style="padding:8px 0;color:#0F1E44;">${booking.note}</td></tr>` : ''}
            </table>
            <div style="margin-top:24px;text-align:center;">
              <a href="${process.env.SITE_URL || 'http://localhost:' + PORT}/admin.html" style="display:inline-block;padding:12px 32px;background:#EFC14B;color:#0F1E44;font-weight:700;border-radius:50px;text-decoration:none;">Xem trong Admin</a>
            </div>
          </div>
        </div>
      `
    });
    console.log('Admin notification email sent to', adminEmail);
  } catch (err) {
    console.error('Failed to send admin email:', err.message);
  }

  // Confirmation email to customer
  if (booking.email) {
    try {
      await transporter.sendMail({
        from: `"AiiCafe" <${process.env.GMAIL_USER}>`,
        to: booking.email,
        subject: `Xác nhận đặt bàn tại AiiCafe - ${booking.date}`,
        html: `
          <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#FDF8EE;border-radius:12px;overflow:hidden;">
            <div style="background:#0F1E44;padding:24px 32px;text-align:center;">
              <h1 style="color:#EFC14B;margin:0;font-size:24px;">AiiCafe</h1>
              <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Where love brews and dreams grow</p>
            </div>
            <div style="padding:32px;">
              <h2 style="color:#0F1E44;margin:0 0 16px;">Xin chào ${booking.name}!</h2>
              <p style="color:#3D4663;line-height:1.6;">Cảm ơn bạn đã đặt bàn tại AiiCafe. Chúng tôi đã nhận được yêu cầu của bạn và sẽ xác nhận sớm nhất.</p>
              <div style="background:white;border-radius:12px;padding:20px;margin:20px 0;border:1px solid rgba(15,30,68,0.08);">
                <h3 style="color:#0F1E44;margin:0 0 12px;font-size:16px;">Chi tiết đặt bàn</h3>
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:6px 0;color:#7A829A;width:120px;">Mã đặt bàn:</td><td style="padding:6px 0;font-weight:600;color:#0F1E44;">${booking.booking_id}</td></tr>
                  <tr><td style="padding:6px 0;color:#7A829A;">Ngày:</td><td style="padding:6px 0;font-weight:600;color:#0F1E44;">${booking.date}</td></tr>
                  <tr><td style="padding:6px 0;color:#7A829A;">Giờ:</td><td style="padding:6px 0;font-weight:600;color:#0F1E44;">${booking.time}</td></tr>
                  <tr><td style="padding:6px 0;color:#7A829A;">Số khách:</td><td style="padding:6px 0;color:#0F1E44;">${booking.guests}</td></tr>
                  <tr><td style="padding:6px 0;color:#7A829A;">Khu vực:</td><td style="padding:6px 0;color:#0F1E44;">${areaText}</td></tr>
                </table>
              </div>
              <p style="color:#3D4663;line-height:1.6;font-size:14px;">Nếu cần thay đổi, vui lòng liên hệ chúng tôi qua điện thoại <strong>0900 xxx xxx</strong> hoặc email <strong>hello@aiicafe.vn</strong></p>
            </div>
            <div style="background:#0F1E44;padding:16px 32px;text-align:center;">
              <p style="color:rgba(255,255,255,0.5);margin:0;font-size:12px;">&copy; 2026 AiiCafe — Hệ sinh thái AiiHouse</p>
            </div>
          </div>
        `
      });
      console.log('Customer confirmation email sent to', booking.email);

      // Mark email as sent
      db.prepare('UPDATE bookings SET email_sent = 1 WHERE booking_id = ?').run(booking.booking_id);
    } catch (err) {
      console.error('Failed to send customer email:', err.message);
    }
  }
}

// ── API Routes ──

// Create booking
app.post('/api/bookings', (req, res) => {
  try {
    const { name, email, phone, date, time, guests, area, note } = req.body;

    // Validation
    if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Tên không hợp lệ' });
    if (!phone || !/^0\d{8,10}$/.test(phone.replace(/\s/g, ''))) return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
    if (!date) return res.status(400).json({ error: 'Vui lòng chọn ngày' });
    if (!time) return res.status(400).json({ error: 'Vui lòng chọn giờ' });
    if (!guests) return res.status(400).json({ error: 'Vui lòng chọn số khách' });

    const bookingId = 'AII-' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const stmt = db.prepare(`
      INSERT INTO bookings (booking_id, name, email, phone, date, time, guests, area, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(bookingId, name.trim(), (email || '').trim(), phone.replace(/\s/g, ''), date, time, guests, area || 'indoor', (note || '').trim(), now, now);

    const booking = db.prepare('SELECT * FROM bookings WHERE booking_id = ?').get(bookingId);

    // Send emails asynchronously
    sendBookingEmails(booking).catch(err => console.error('Email error:', err));

    // Send ntfy.sh push notification
    const areaMap = { indoor: 'Trong nhà', outdoor: 'Ngoài trời', kids: 'Khu vui chơi trẻ em' };
    const ntfyBody = `${name.trim()} - ${phone.replace(/\s/g, '')}\nNgày: ${date} | Giờ: ${time}\nSố khách: ${guests} | Khu vực: ${areaMap[area] || area}${note ? '\nGhi chú: ' + note.trim() : ''}`;
    fetch('https://ntfy.sh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'aiicafe-datban',
        title: 'Đặt bàn mới - ' + bookingId,
        message: ntfyBody,
        tags: ['coffee', 'bell'],
        priority: 4
      })
    }).then(r => console.log('ntfy.sh sent, status:', r.status))
      .catch(err => console.error('ntfy.sh error:', err.message));

    res.json({ success: true, booking_id: bookingId, message: 'Đặt bàn thành công!' });
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại.' });
  }
});

// ── Admin API (Basic Auth) ──
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const [username, password] = decoded.split(':');
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'aiicafe2026';

  if (username === adminUser && password === adminPass) {
    next();
  } else {
    res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
  }
}

// Get all bookings
app.get('/api/admin/bookings', adminAuth, (req, res) => {
  const { status, date, search } = req.query;
  let sql = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (date) {
    sql += ' AND date = ?';
    params.push(date);
  }
  if (search) {
    sql += ' AND (name LIKE ? OR phone LIKE ? OR booking_id LIKE ? OR email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  sql += ' ORDER BY date DESC, time DESC';

  const bookings = db.prepare(sql).all(...params);
  const stats = {
    total: db.prepare('SELECT COUNT(*) as c FROM bookings').get().c,
    pending: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'pending'").get().c,
    confirmed: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'confirmed'").get().c,
    cancelled: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'cancelled'").get().c,
    today: db.prepare("SELECT COUNT(*) as c FROM bookings WHERE date = ?").get(new Date().toISOString().slice(0, 10)).c
  };

  res.json({ bookings, stats });
});

// Update booking status
app.patch('/api/admin/bookings/:id', adminAuth, (req, res) => {
  const { status, table_number } = req.body;
  const booking = db.prepare('SELECT * FROM bookings WHERE booking_id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Không tìm thấy đặt bàn' });

  const updates = [];
  const params = [];

  if (status) {
    updates.push('status = ?');
    params.push(status);
  }
  if (table_number !== undefined) {
    updates.push('table_number = ?');
    params.push(table_number);
  }

  updates.push("updated_at = ?");
  params.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
  params.push(req.params.id);

  db.prepare(`UPDATE bookings SET ${updates.join(', ')} WHERE booking_id = ?`).run(...params);

  // Send status update email to customer
  if (status && booking.email && transporter) {
    const statusMap = { confirmed: 'Đã xác nhận', cancelled: 'Đã hủy', completed: 'Hoàn thành' };
    const statusText = statusMap[status] || status;
    transporter.sendMail({
      from: `"AiiCafe" <${process.env.GMAIL_USER}>`,
      to: booking.email,
      subject: `Cập nhật đặt bàn - ${statusText} | AiiCafe`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#FDF8EE;border-radius:12px;overflow:hidden;">
          <div style="background:#0F1E44;padding:24px 32px;text-align:center;">
            <h1 style="color:#EFC14B;margin:0;font-size:24px;">AiiCafe</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#0F1E44;margin:0 0 16px;">Xin chào ${booking.name}!</h2>
            <p style="color:#3D4663;line-height:1.6;">Đặt bàn <strong>${booking.booking_id}</strong> của bạn đã được cập nhật:</p>
            <div style="text-align:center;margin:24px 0;">
              <span style="display:inline-block;padding:12px 32px;background:${status === 'confirmed' ? '#4CAF72' : status === 'cancelled' ? '#FF3131' : '#EFC14B'};color:white;font-weight:700;border-radius:50px;font-size:18px;">${statusText}</span>
            </div>
            <div style="background:white;border-radius:12px;padding:20px;border:1px solid rgba(15,30,68,0.08);">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#7A829A;width:120px;">Ngày:</td><td style="padding:6px 0;font-weight:600;color:#0F1E44;">${booking.date}</td></tr>
                <tr><td style="padding:6px 0;color:#7A829A;">Giờ:</td><td style="padding:6px 0;font-weight:600;color:#0F1E44;">${booking.time}</td></tr>
                <tr><td style="padding:6px 0;color:#7A829A;">Số khách:</td><td style="padding:6px 0;color:#0F1E44;">${booking.guests}</td></tr>
                ${table_number ? `<tr><td style="padding:6px 0;color:#7A829A;">Bàn số:</td><td style="padding:6px 0;font-weight:600;color:#0F1E44;">${table_number}</td></tr>` : ''}
              </table>
            </div>
            <p style="color:#3D4663;line-height:1.6;font-size:14px;margin-top:16px;">Liên hệ: <strong>0900 xxx xxx</strong> | <strong>hello@aiicafe.vn</strong></p>
          </div>
          <div style="background:#0F1E44;padding:16px 32px;text-align:center;">
            <p style="color:rgba(255,255,255,0.5);margin:0;font-size:12px;">&copy; 2026 AiiCafe — Hệ sinh thái AiiHouse</p>
          </div>
        </div>
      `
    }).catch(err => console.error('Status email error:', err.message));
  }

  const updated = db.prepare('SELECT * FROM bookings WHERE booking_id = ?').get(req.params.id);
  res.json({ success: true, booking: updated });
});

// Delete booking
app.delete('/api/admin/bookings/:id', adminAuth, (req, res) => {
  const result = db.prepare('DELETE FROM bookings WHERE booking_id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Không tìm thấy đặt bàn' });
  res.json({ success: true });
});

// ── Media Config API ──

// Public: get media config
app.get('/api/media-config', (req, res) => {
  res.json(readMediaConfig());
});

// Admin: update media config (full or partial)
app.put('/api/admin/media-config', adminAuth, (req, res) => {
  const current = readMediaConfig();
  const updated = Object.assign(current, req.body);
  writeMediaConfig(updated);
  res.json({ success: true, config: updated });
});

// Admin: upload file
app.post('/api/admin/upload', adminAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = 'assets/uploads/' + req.file.filename;
  res.json({ success: true, url });
});

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.listen(PORT, () => {
  console.log(`AiiCafe server running at http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin.html`);
});
