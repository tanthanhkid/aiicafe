import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('*', cors());

// ── Email via Resend API ──
async function sendEmail({ from, to, subject, html, apiKey }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  const data = await res.json();
  if (!res.ok) console.error('Resend error:', JSON.stringify(data));
  return res.ok;
}

function bookingEmailHtml(booking, type) {
  const areaMap = { indoor: 'Trong nhà', outdoor: 'Ngoài trời', kids: 'Khu vui chơi trẻ em' };
  const areaText = areaMap[booking.area] || booking.area;
  if (type === 'admin') {
    return '<div style="font-family:\'Segoe UI\',Arial,sans-serif;max-width:600px;margin:0 auto;background:#FDF8EE;border-radius:12px;overflow:hidden;">' +
      '<div style="background:#0F1E44;padding:24px 32px;text-align:center;"><h1 style="color:#EFC14B;margin:0;font-size:24px;">Đặt bàn mới tại AiiCafe</h1></div>' +
      '<div style="padding:32px;"><table style="width:100%;border-collapse:collapse;">' +
      '<tr><td style="padding:8px 0;color:#7A829A;width:140px;">Mã đặt bàn:</td><td style="padding:8px 0;font-weight:600;color:#0F1E44;">' + booking.booking_id + '</td></tr>' +
      '<tr><td style="padding:8px 0;color:#7A829A;">Khách hàng:</td><td style="padding:8px 0;font-weight:600;color:#0F1E44;">' + booking.name + '</td></tr>' +
      '<tr><td style="padding:8px 0;color:#7A829A;">Điện thoại:</td><td style="padding:8px 0;color:#0F1E44;">' + booking.phone + '</td></tr>' +
      '<tr><td style="padding:8px 0;color:#7A829A;">Email:</td><td style="padding:8px 0;color:#0F1E44;">' + (booking.email || 'Không có') + '</td></tr>' +
      '<tr><td style="padding:8px 0;color:#7A829A;">Ngày:</td><td style="padding:8px 0;font-weight:600;color:#0F1E44;">' + booking.date + '</td></tr>' +
      '<tr><td style="padding:8px 0;color:#7A829A;">Giờ:</td><td style="padding:8px 0;font-weight:600;color:#0F1E44;">' + booking.time + '</td></tr>' +
      '<tr><td style="padding:8px 0;color:#7A829A;">Số khách:</td><td style="padding:8px 0;color:#0F1E44;">' + booking.guests + '</td></tr>' +
      '<tr><td style="padding:8px 0;color:#7A829A;">Khu vực:</td><td style="padding:8px 0;color:#0F1E44;">' + areaText + '</td></tr>' +
      (booking.note ? '<tr><td style="padding:8px 0;color:#7A829A;vertical-align:top;">Ghi chú:</td><td style="padding:8px 0;color:#0F1E44;">' + booking.note + '</td></tr>' : '') +
      '</table></div></div>';
  }
  // Customer confirmation
  return '<div style="font-family:\'Segoe UI\',Arial,sans-serif;max-width:600px;margin:0 auto;background:#FDF8EE;border-radius:12px;overflow:hidden;">' +
    '<div style="background:#0F1E44;padding:24px 32px;text-align:center;"><h1 style="color:#EFC14B;margin:0;font-size:24px;">AiiCafe</h1><p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Where love brews and dreams grow</p></div>' +
    '<div style="padding:32px;"><h2 style="color:#0F1E44;margin:0 0 16px;">Xin chào ' + booking.name + '!</h2>' +
    '<p style="color:#3D4663;line-height:1.6;">Cảm ơn bạn đã đặt bàn tại AiiCafe. Chúng tôi đã nhận được yêu cầu và sẽ xác nhận sớm nhất.</p>' +
    '<div style="background:white;border-radius:12px;padding:20px;margin:20px 0;border:1px solid rgba(15,30,68,0.08);">' +
    '<h3 style="color:#0F1E44;margin:0 0 12px;font-size:16px;">Chi tiết đặt bàn</h3><table style="width:100%;border-collapse:collapse;">' +
    '<tr><td style="padding:6px 0;color:#7A829A;width:120px;">Mã:</td><td style="padding:6px 0;font-weight:600;color:#0F1E44;">' + booking.booking_id + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#7A829A;">Ngày:</td><td style="padding:6px 0;font-weight:600;color:#0F1E44;">' + booking.date + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#7A829A;">Giờ:</td><td style="padding:6px 0;font-weight:600;color:#0F1E44;">' + booking.time + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#7A829A;">Số khách:</td><td style="padding:6px 0;color:#0F1E44;">' + booking.guests + '</td></tr>' +
    '<tr><td style="padding:6px 0;color:#7A829A;">Khu vực:</td><td style="padding:6px 0;color:#0F1E44;">' + areaText + '</td></tr>' +
    '</table></div>' +
    '<p style="color:#3D4663;line-height:1.6;font-size:14px;">Liên hệ: <strong>0900 xxx xxx</strong> | <strong>hello@aiicafe.vn</strong></p></div>' +
    '<div style="background:#0F1E44;padding:16px 32px;text-align:center;"><p style="color:rgba(255,255,255,0.5);margin:0;font-size:12px;">&copy; 2026 AiiCafe — Hệ sinh thái AiiHouse</p></div></div>';
}

// Helper: admin auth check
function checkAuth(c) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  const decoded = atob(authHeader.split(' ')[1]);
  const [username, password] = decoded.split(':');
  return username === c.env.ADMIN_USERNAME && password === c.env.ADMIN_PASSWORD;
}

function adminAuth(c, next) {
  if (!checkAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  return next();
}

// Helper: generate booking ID
function generateBookingId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(2)))
    .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return 'AII-' + ts + rand;
}

// ── Public API ──

// Create booking
app.post('/api/bookings', async (c) => {
  try {
    const { name, email, phone, date, time, guests, area, note } = await c.req.json();

    // Validation
    if (!name || name.trim().length < 2) return c.json({ error: 'Tên không hợp lệ' }, 400);
    if (!phone || !/^0\d{8,10}$/.test(phone.replace(/\s/g, ''))) return c.json({ error: 'Số điện thoại không hợp lệ' }, 400);
    if (!date) return c.json({ error: 'Vui lòng chọn ngày' }, 400);
    if (!time) return c.json({ error: 'Vui lòng chọn giờ' }, 400);
    if (!guests) return c.json({ error: 'Vui lòng chọn số khách' }, 400);

    const bookingId = generateBookingId();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const cleanPhone = phone.replace(/\s/g, '');
    const cleanName = name.trim();
    const cleanEmail = (email || '').trim();
    const cleanNote = (note || '').trim();
    const cleanArea = area || 'indoor';

    await c.env.DB.prepare(
      'INSERT INTO bookings (booking_id, name, email, phone, date, time, guests, area, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(bookingId, cleanName, cleanEmail, cleanPhone, date, time, guests, cleanArea, cleanNote, now, now).run();

    // Send ntfy.sh push notification (non-blocking)
    const areaMap = { indoor: 'Trong nhà', outdoor: 'Ngoài trời', kids: 'Khu vui chơi trẻ em' };
    const ntfyTopic = c.env.NTFY_TOPIC || 'aiicafe-datban';
    const ntfyBody = `${cleanName} - ${cleanPhone}\nNgày: ${date} | Giờ: ${time}\nSố khách: ${guests} | Khu vực: ${areaMap[cleanArea] || cleanArea}${cleanNote ? '\nGhi chú: ' + cleanNote : ''}`;

    c.executionCtx.waitUntil(
      fetch('https://ntfy.sh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: ntfyTopic,
          title: 'Dat ban moi - ' + bookingId,
          message: ntfyBody,
          tags: ['coffee', 'bell'],
          priority: 4
        })
      }).catch(err => console.error('ntfy error:', err))
    );

    // Send email via Resend
    if (c.env.RESEND_API_KEY) {
      const bookingData = { booking_id: bookingId, name: cleanName, email: cleanEmail, phone: cleanPhone, date, time, guests, area: cleanArea, note: cleanNote };
      c.executionCtx.waitUntil(
        sendEmail({
          from: 'AiiCafe Booking <booking@aiicafe.vn>',
          to: c.env.ADMIN_EMAIL || 'info@aiicafe.vn',
          subject: '[Đặt bàn mới] ' + cleanName + ' - ' + date + ' ' + time,
          html: bookingEmailHtml(bookingData, 'admin'),
          apiKey: c.env.RESEND_API_KEY
        }).then(ok => console.log('Admin email:', ok ? 'sent' : 'failed'))
      );
    }

    return c.json({ success: true, booking_id: bookingId, message: 'Đặt bàn thành công!' });
  } catch (err) {
    console.error('Booking error:', err);
    return c.json({ error: 'Có lỗi xảy ra, vui lòng thử lại.' }, 500);
  }
});

// Get media config (public)
app.get('/api/media-config', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key, value FROM media_config').all();
  const config = {};
  for (const row of results) {
    config[row.key] = row.value;
  }
  return c.json(config);
});

// ── Admin API ──

// Get all bookings
app.get('/api/admin/bookings', async (c) => {
  if (!checkAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  const status = c.req.query('status');
  const date = c.req.query('date');
  const search = c.req.query('search');

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
    const s = '%' + search + '%';
    params.push(s, s, s, s);
  }
  sql += ' ORDER BY date DESC, time DESC';

  const stmt = c.env.DB.prepare(sql);
  const { results: bookings } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

  const today = new Date().toISOString().slice(0, 10);
  const totalR = await c.env.DB.prepare('SELECT COUNT(*) as c FROM bookings').first();
  const pendingR = await c.env.DB.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'pending'").first();
  const confirmedR = await c.env.DB.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'confirmed'").first();
  const cancelledR = await c.env.DB.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'cancelled'").first();
  const todayR = await c.env.DB.prepare('SELECT COUNT(*) as c FROM bookings WHERE date = ?').bind(today).first();

  const stats = {
    total: totalR.c,
    pending: pendingR.c,
    confirmed: confirmedR.c,
    cancelled: cancelledR.c,
    today: todayR.c
  };

  return c.json({ bookings, stats });
});

// Update booking status
app.patch('/api/admin/bookings/:id', async (c) => {
  if (!checkAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  const { status, table_number } = await c.req.json();
  const bookingId = c.req.param('id');

  const booking = await c.env.DB.prepare('SELECT * FROM bookings WHERE booking_id = ?').bind(bookingId).first();
  if (!booking) return c.json({ error: 'Không tìm thấy đặt bàn' }, 404);

  const updates = [];
  const params = [];

  if (status) { updates.push('status = ?'); params.push(status); }
  if (table_number !== undefined) { updates.push('table_number = ?'); params.push(table_number); }
  updates.push('updated_at = ?');
  params.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
  params.push(bookingId);

  await c.env.DB.prepare(`UPDATE bookings SET ${updates.join(', ')} WHERE booking_id = ?`).bind(...params).run();

  const updated = await c.env.DB.prepare('SELECT * FROM bookings WHERE booking_id = ?').bind(bookingId).first();
  return c.json({ success: true, booking: updated });
});

// Delete booking
app.delete('/api/admin/bookings/:id', async (c) => {
  if (!checkAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  const result = await c.env.DB.prepare('DELETE FROM bookings WHERE booking_id = ?').bind(c.req.param('id')).run();
  if (result.meta.changes === 0) return c.json({ error: 'Không tìm thấy đặt bàn' }, 404);
  return c.json({ success: true });
});

// Update media config
app.put('/api/admin/media-config', async (c) => {
  if (!checkAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const stmts = Object.entries(body).map(([key, value]) =>
    c.env.DB.prepare('INSERT OR REPLACE INTO media_config (key, value) VALUES (?, ?)').bind(key, value)
  );
  await c.env.DB.batch(stmts);

  // Return full config
  const { results } = await c.env.DB.prepare('SELECT key, value FROM media_config').all();
  const config = {};
  for (const row of results) config[row.key] = row.value;
  return c.json({ success: true, config });
});

// Upload file to R2 (if available)
app.post('/api/admin/upload', async (c) => {
  if (!checkAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  if (!c.env.R2) return c.json({ error: 'R2 chưa được kích hoạt. Vào Cloudflare Dashboard → R2 để enable.' }, 400);

  try {
    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!file) return c.json({ error: 'No file uploaded' }, 400);

    const allowed = /\.(jpeg|jpg|png|gif|webp|mp4|webm|mov)$/i;
    if (!allowed.test(file.name)) return c.json({ error: 'File type not allowed' }, 400);

    const ext = file.name.split('.').pop();
    const safeName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = safeName + '_' + Date.now() + '.' + ext;
    const key = 'uploads/' + filename;

    await c.env.R2.put(key, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    const url = 'assets/uploads/' + filename;
    return c.json({ success: true, url });
  } catch (err) {
    console.error('Upload error:', err);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

// Serve R2 uploaded files
app.get('/assets/uploads/:filename', async (c) => {
  if (!c.env.R2) return c.notFound();
  const key = 'uploads/' + c.req.param('filename');
  const object = await c.env.R2.get(key);
  if (!object) return c.notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000');
  return new Response(object.body, { headers });
});

export default app;
