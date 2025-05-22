// app.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const path = require('path');
// const sqlite3 = require('sqlite3').verbose(); // Hapus baris ini
const mysql = require('mysql2/promise'); // Tambahkan baris ini
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const AUTH_TOKEN = "your-secret-token"; // Ganti dengan token rahasia yang aman

const app = express();
const port = 3000;

// Middleware untuk parsing JSON dan form data
app.use(express.json()); // <-- Tambahkan ini agar bisa menerima JSON
app.use(express.urlencoded({ extended: true }));

// Konfigurasi express-ejs-layouts
app.use(expressLayouts);
app.set('layout', 'layout'); // layout utama berada di views/layout.ejs

// Setup view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Konfigurasi session dan Passport
app.use(session({
  secret: 'secret-key', // ganti dengan secret yang lebih kuat di production
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// const users = [
//   { id: 1, username: 'admin', password: 'admin' } // Password dalam contoh plain-text (gunakan hash untuk production)
// ];

// Konfigurasi Passport Local Strategy
passport.use(new LocalStrategy(
  async function(username, password, done) { // Tambahkan async
    try {
      const [rows] = await dbPool.execute('SELECT * FROM users WHERE username = ?', [username]);
      if (rows.length === 0) {
        return done(null, false, { message: 'Username tidak ditemukan.' });
      }
      const user = rows[0];
      // PENTING: Ganti perbandingan password ini dengan perbandingan hash di produksi
      if (user.password !== password) { 
        return done(null, false, { message: 'Password salah.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id); // Asumsi 'id' adalah primary key di tabel users
});

passport.deserializeUser(async function(id, done) { // Tambahkan async
  try {
    const [rows] = await dbPool.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0) {
      return done(null, false); // Atau done(new Error('User not found.'));
    }
    const user = rows[0];
    return done(null, user);
  } catch (err) {
    return done(err);
  }
});

// Tambahkan Konfigurasi Koneksi MySQL Pool
const dbPool = mysql.createPool({
  host: 'localhost', // Ganti dengan host MySQL Anda jika berbeda
  user: 'root', // Ganti dengan username MySQL Anda
  password: '', // Ganti dengan password MySQL Anda
  database: 'huda_wagateway', // Ganti dengan nama database MySQL Anda
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Inisialisasi WhatsApp client dengan LocalAuth agar sesi tersimpan
const client = new Client({
  authStrategy: new LocalAuth(),
  // puppeteer: { headless: true }
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});


// Variabel untuk menyimpan data QR Code dan info login WhatsApp
let qrCodeData = '';
let loggedInInfo = null;

// Event: Saat QR Code diterima
client.on('qr', (qr) => {
  console.log('QR Code diterima, silahkan scan pada WhatsApp anda.');
  qrcode.toDataURL(qr, (err, url) => {
    if (!err) {
      qrCodeData = url;
    }
  });
});

// Event: Saat client siap
client.on('ready', async () => {
  console.log('Client WhatsApp sudah siap!');
  qrCodeData = ''; // Hapus QR Code setelah login berhasil
  loggedInInfo = client.info;
  try {
    const profilePicUrl = await client.getProfilePicUrl(client.info.wid._serialized);
    loggedInInfo.profilePic = profilePicUrl;
  } catch (error) {
    loggedInInfo.profilePic = '/images/default-profile.png';
  }
  
  // Inisialisasi scheduler
  const { initializeScheduler } = require('./scheduled_blast');
  initializeScheduler(client);
});

// Mulai client WhatsApp
client.initialize();

// Middleware untuk memproteksi route (login required)
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Middleware untuk verifikasi Bearer Token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized, token is missing' });
  }

  const token = authHeader.split(' ')[1]; // Ambil token setelah "Bearer "
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized, invalid token' });
  }

  next(); // Lanjutkan ke route handler jika token valid
};

// Routes untuk Login
app.get('/login', (req, res) => {
  res.render('login', {layout: false, title: 'Login', activePage: 'login', message: '' });
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login'
}));

app.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/login');
  });
});

// Route untuk logout WhatsApp
app.post('/logout-whatsapp', isAuthenticated, async (req, res) => {
  try {
    // Reset variabel terlebih dahulu
    loggedInInfo = null;
    qrCodeData = '';
    
    // Tunggu sebentar sebelum destroy
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      // Coba destroy client
      await client.destroy();
    } catch (error) {
      console.error('Error destroying client:', error);
      // Lanjutkan meskipun ada error
    }
    
    // Tunggu sebentar untuk memastikan proses selesai
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Inisialisasi ulang client
    await client.initialize();
    
    // Redirect ke halaman QR dengan parameter refresh
    res.redirect('/qr?refresh=true');
  } catch (error) {
    console.error('Error during WhatsApp logout:', error);
    // Tetap redirect ke QR meskipun ada error
    res.redirect('/qr?refresh=true');
  }
});

// Route untuk Dashboard (hanya untuk user yang sudah login)
app.get('/', isAuthenticated, (req, res) => {
  res.render('index', { 
    title: 'Dashboard',
    activePage: 'dashboard',
    loggedInInfo: loggedInInfo,
    qrCodeData,
  });
});

// Route untuk halaman QR (hanya untuk user yang sudah login)
app.get('/qr', isAuthenticated, (req, res) => {
  res.render('qr', { 
    title: 'QR Code Login',
    activePage: 'qr',
    qrCodeData,
    loggedInInfo,
    req // Tambahkan ini untuk meneruskan req ke template
  });
});

// Route untuk halaman Logs (hanya untuk user yang sudah login)
app.get('/logs', isAuthenticated, (req, res) => {
  res.render('logs', { 
    title: 'Logs Pengiriman Pesan',
    activePage: 'logs',
    loggedInInfo: loggedInInfo
  });
});

// Route untuk data logs dengan server-side processing
app.get('/logs/data', isAuthenticated, async (req, res) => { // Tambahkan async
  // Parameter dari DataTables
  const draw = parseInt(req.query.draw) || 1;
  const start = parseInt(req.query.start) || 0;
  const length = parseInt(req.query.length) || 10;
  const search = req.query.search.value;

  try {
    // Dapatkan total jumlah record
    const [countRows] = await dbPool.execute(`SELECT COUNT(*) as count FROM message_logs`);
    const recordsTotal = countRows[0].count;
    let recordsFiltered = recordsTotal;
    let query;
    let queryParams = [];

    if (search && search.trim() !== "") {
      const searchQuery = `%${search}%`;
      query = `SELECT * FROM message_logs 
               WHERE phone LIKE ? OR message LIKE ? OR status LIKE ?
               ORDER BY timestamp DESC
               LIMIT ? OFFSET ?`;
      queryParams = [searchQuery, searchQuery, searchQuery, length, start];
      
      const [filteredCountRows] = await dbPool.execute(
        `SELECT COUNT(*) as count FROM message_logs 
         WHERE phone LIKE ? OR message LIKE ? OR status LIKE ?`,
        [searchQuery, searchQuery, searchQuery]
      );
      recordsFiltered = filteredCountRows[0].count;
    } else {
      query = `SELECT * FROM message_logs 
               ORDER BY timestamp DESC 
               LIMIT ? OFFSET ?`;
      queryParams = [length, start];
    }

    const [rows] = await dbPool.execute(query, queryParams);
    res.json({
      draw: draw,
      recordsTotal: recordsTotal,
      recordsFiltered: recordsFiltered,
      data: rows
    });
  } catch (err) {
    console.error('Error fetching logs data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all contact groups
app.get('/contact-groups', async (req, res) => {
  try {
    const [rows] = await dbPool.execute('SELECT * FROM contact_groups ORDER BY name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data grup' });
  }
});

// Add new contact group
app.post('/contact-groups/add', async (req, res) => {
  const { name } = req.body;
  try {
    await dbPool.execute('INSERT INTO contact_groups (name) VALUES (?)', [name]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menambah grup' });
  }
});

// Delete contact group
app.delete('/contact-groups/delete/:id', async (req, res) => {
  try {
    await dbPool.execute('DELETE FROM contact_groups WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus grup' });
  }
});

// Route untuk halaman Phone Book (hanya untuk user yang sudah login)
app.get('/phonebook', isAuthenticated, (req, res) => {
  res.render('phonebook', { 
    title: 'Phone Book',
    activePage: 'phonebook',
    loggedInInfo: loggedInInfo
  });
});

// Route untuk data phone book dengan server-side processing
app.get('/phonebook/data', isAuthenticated, async (req, res) => {
  const draw = parseInt(req.query.draw) || 1;
  const start = parseInt(req.query.start) || 0;
  const length = parseInt(req.query.length) || 10;
  const search = req.query.search.value;
  const groupId = req.query.group_id; // Tambahkan parameter group_id

  try {
    let baseQuery = 'FROM phone_book pb LEFT JOIN contact_groups cg ON pb.group_id = cg.id';
    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    // Filter berdasarkan grup jika ada
    if (groupId) {
      whereClause += ' AND pb.group_id = ?';
      queryParams.push(groupId);
    }

    // Hitung total records
    const [countRows] = await dbPool.execute(`SELECT COUNT(*) as count ${baseQuery}`);
    const recordsTotal = countRows[0].count;
    let recordsFiltered = recordsTotal;

    // Tambahkan pencarian jika ada
    if (search && search.trim() !== "") {
      const searchQuery = `%${search}%`;
      whereClause += ' AND (pb.name LIKE ? OR CONCAT(pb.country_code, pb.phone) LIKE ?)';
      queryParams.push(searchQuery, searchQuery);

      const [filteredCountRows] = await dbPool.execute(
        `SELECT COUNT(*) as count ${baseQuery} ${whereClause}`,
        queryParams
      );
      recordsFiltered = filteredCountRows[0].count;
    }

    // Query utama dengan join ke tabel grup
    const query = `
      SELECT 
        pb.id,
        pb.name,
        CONCAT(pb.country_code, pb.phone) AS phone,
        pb.group_id,
        cg.name as group_name
      ${baseQuery}
      ${whereClause}
      ORDER BY pb.name ASC 
      LIMIT ? OFFSET ?
    `;

    queryParams.push(length, start);
    const [rows] = await dbPool.execute(query, queryParams);

    res.json({
      draw: draw,
      recordsTotal: recordsTotal,
      recordsFiltered: recordsFiltered,
      data: rows
    });
  } catch (err) {
    console.error('Error fetching phonebook data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Route untuk menambahkan kontak baru
app.post('/phonebook/add', async (req, res) => {
  const { name, country_code, phone, group_id } = req.body;
  
  try {    
    await dbPool.execute(
      'INSERT INTO phone_book (name, country_code, phone, group_id) VALUES (?, ?, ?, ?)',
      [name, country_code, phone, group_id]
    );
    res.redirect('/phonebook');
  } catch (error) {
    console.error('Error saat menambah kontak:', error);
    res.status(500).send('Terjadi kesalahan saat menambahkan kontak');
  }
});

// Route untuk mendapatkan data kontak
app.get('/phonebook/:id', async (req, res) => {
  try {
    const [rows] = await dbPool.execute('SELECT * FROM phone_book WHERE id = ?', [req.params.id]);
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ error: 'Kontak tidak ditemukan' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// Route untuk update kontak
app.post('/phonebook/update', async (req, res) => {
  const { edit_id, name, country_code, phone } = req.body;
  
  try {
    await dbPool.execute(
      'UPDATE phone_book SET name = ?, country_code = ? , phone = ? WHERE id = ?',
      [name, country_code, phone, edit_id]
    );
    res.json({ success: true }); // Ubah menjadi response JSON
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengupdate kontak' });
  }
});

// Route untuk delete kontak
app.delete('/phonebook/delete/:id', async (req, res) => {
  try {
    await dbPool.execute('DELETE FROM phone_book WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan saat menghapus kontak' });
  }
});

// // Route untuk halaman Blast (hanya untuk user yang sudah login)
// app.get('/blast', isAuthenticated, (req, res) => {
//   const status = req.query.status || '';
//   res.render('blast', { 
//     title: 'Blast Pesan',
//     activePage: 'blast',
//     status,
//     loggedInInfo: loggedInInfo
//   });
// });

// Route untuk halaman Blast
app.get('/blast', isAuthenticated, async (req, res) => {
  const status = req.query.status || '';
  try {
    const [groups] = await dbPool.execute('SELECT * FROM contact_groups ORDER BY name');
    res.render('blast', { 
      title: 'Blast Pesan',
      activePage: 'blast',
      status,
      groups,
      loggedInInfo: loggedInInfo
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.render('blast', { 
      title: 'Blast Pesan',
      activePage: 'blast',
      status: 'error',
      groups: [],
      loggedInInfo: loggedInInfo
    });
  }
});

const multer = require('multer');
const fs = require('fs');

// Konfigurasi multer untuk upload file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Route untuk blast
app.post('/blast', isAuthenticated, upload.single('media'), async (req, res) => {
  const { message, group_id, send_type, schedule_time, message_type } = req.body;
  const media = req.file;
  
  try {
    if (send_type === 'schedule') {
      // Simpan ke tabel blast_schedules
      await dbPool.execute(
        `INSERT INTO blast_schedules (group_id, message, message_type, media_url, media_name, schedule_time) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [group_id, message, message_type, media ? media.path : null, media ? media.originalname : null, schedule_time]
      );
      return res.redirect('/blast?status=scheduled');
    }

    // Kirim pesan sekarang
    const [contacts] = await dbPool.execute(
      `SELECT id, name, CONCAT(country_code,phone) AS phone 
       FROM phone_book 
       WHERE group_id = ?`,
      [group_id]
    );

    if (!contacts || contacts.length === 0) {
      return res.redirect('/blast?status=noContacts');
    }
    
    let messagesSent = 0;
    
    // Buat log awal dengan status pending untuk semua kontak
    for (const contact of contacts) {
      const phone = contact.phone;
      await dbPool.execute(
        `INSERT INTO message_logs (phone, message, message_type, media_url, media_name, status, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [phone, message, message_type, media ? media.path : null, media ? media.originalname : null, 'pending']
      );
    }
    
    for (const contact of contacts) {
      const phone = contact.phone;
      const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;
      
      try {
        // Update status menjadi processing
        await dbPool.execute(
          `UPDATE message_logs 
           SET status = 'processing' 
           WHERE phone = ? AND message = ? AND status = 'pending'`,
          [phone, message]
        );

        let messageResponse;
        if (message_type === 'text') {
          messageResponse = await client.sendMessage(chatId, message);
        } else {
          // Cek koneksi dengan cara yang benar
          if (!client.pupPage) {
            throw new Error('WhatsApp tidak terhubung');
          }

          // Tambahkan try-catch khusus untuk media
          try {
            const mediaMessage = MessageMedia.fromFilePath(media.path);
            
            // Tambahkan opsi khusus untuk video
            if (message_type === 'video') {
              // Tambahkan delay lebih lama untuk video
              // await new Promise(resolve => setTimeout(resolve, 8000));
              
              // // Kirim sebagai video biasa
              // const options = {
              //   caption: message,
              //   sendMediaAsDocument: false // Pastikan dikirim sebagai video
              // };
              
              // messageResponse = await client.sendMessage(chatId, mediaMessage, options);

              try {
                const mediaMessage = MessageMedia.fromFilePath(media.path);
                
              console.log('Media path:', media.path);
              console.log('Exists:', fs.existsSync(media.path));

                const options = {
                  caption: message,
                  sendMediaAsDocument: false, // bisa coba true juga untuk debugging
                };
            
                console.log('Sending video...');
                messageResponse = await client.sendMessage(chatId, mediaMessage, options);
              } catch (err) {
                console.error('Gagal kirim video:', err.message);
                throw err;
              }
            } else {
              // Untuk media lain (gambar, dokumen)
              const options = { 
                caption: message,
                sendMediaAsDocument: message_type === 'document'
              };
              messageResponse = await client.sendMessage(chatId, mediaMessage, options);
            }
          } catch (mediaError) {
            console.error('Error saat mengirim media:', mediaError);
            throw new Error(`Gagal mengirim media: ${mediaError.message}`);
          }
        }

        // Update status menjadi completed jika berhasil
        await dbPool.execute(
          `UPDATE message_logs 
           SET status = 'completed' 
           WHERE phone = ? AND message = ? AND status = 'processing'`,
          [phone, message]
        );

        messagesSent++;
        
        if (messagesSent % 30 === 0) {
          await new Promise(resolve => setTimeout(resolve, 300000)); // 5 menit
        } else {
          const delay = Math.floor(Math.random() * 5000) + 10000; // 10-15 detik
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`Gagal mengirim pesan ke ${phone}:`, error);
        // Update status menjadi failed jika gagal
        await dbPool.execute(
          `UPDATE message_logs 
           SET status = 'failed' 
           WHERE phone = ? AND message = ? AND status = 'processing'`,
          [phone, message]
        );
      }
    }

    // Hapus file media setelah selesai
    if (media) {
      fs.unlinkSync(media.path);
    }
    
    res.redirect('/blast?status=done');
  } catch (err) {
    console.error('Error during blast:', err);
    return res.redirect('/blast?status=error');
  }
});

// Route untuk menampilkan daftar chat aktif
app.get('/chats', isAuthenticated, (req, res) => {
  client.getChats()
    .then(chats => {
      // Render halaman chats dengan data list chat
      res.render('chats', {
        title: 'Active Chats',
        activePage: 'chats',
        chats: chats
      });
    })
    .catch(err => {
      console.error('Gagal mengambil chat: ', err);
      res.render('chats', {
        title: 'Active Chats',
        activePage: 'chats',
        chats: []
      });
    });
});

// Route untuk menampilkan detail chat berdasarkan chat ID
app.get('/chat/:id', isAuthenticated, (req, res) => {
  const chatId = req.params.id;
  client.getChatById(chatId)
    .then(chat => {
      // Ambil 50 pesan terakhir dari chat
      chat.fetchMessages({ limit: 50 })
        .then(messages => {
          res.render('chat', {
            title: 'Chat Detail',
            activePage: 'chat',
            chat: chat,
            messages: messages
          });
        })
        .catch(err => {
          console.error('Gagal mengambil pesan: ', err);
          res.render('chat', {
            title: 'Chat Detail',
            activePage: 'chat',
            chat: chat,
            messages: []
          });
        });
    })
    .catch(err => {
      console.error('Gagal mengambil chat: ', err);
      res.redirect('/chats?error=chatNotFound');
    });
});


app.post('/send', verifyToken, async (req, res) => { // Tambahkan async
  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).json({ error: 'Nomor dan pesan harus diisi' });
  }

  const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

  try {
    const response = await client.sendMessage(chatId, message);
    try {
      await dbPool.execute(
        "INSERT INTO message_logs (phone, message, status, timestamp) VALUES (?, ?, ?, NOW())",
        [number, message, 'success']
      );
    } catch (logErr) {
      console.error('Gagal menyimpan log pesan (success):', logErr);
    }
    res.json({ status: 'success', response });
  } catch (err) {
    console.error('Gagal mengirim pesan:', err);
    try {
      await dbPool.execute(
        "INSERT INTO message_logs (phone, message, status, timestamp) VALUES (?, ?, ?, NOW())",
        [number, message, 'error']
      );
    } catch (logErr) {
      console.error('Gagal menyimpan log pesan (error):', logErr);
    }
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Jalankan server Express
app.listen(port, () => {
  console.log(`Dashboard berjalan pada http://localhost:${port}`);
});

// Route untuk menampilkan log blast
app.get('/blast-logs', isAuthenticated, async (req, res) => {
  try {
    const [logs] = await dbPool.execute(`
      SELECT 
        ml.*, 
        pb.name AS contact_name,
        bs.schedule_time,
        COALESCE(cg1.name, cg2.name) as group_name
      FROM message_logs ml
      LEFT JOIN blast_schedules bs ON ml.blast_schedule_id = bs.id
      LEFT JOIN contact_groups cg1 ON bs.group_id = cg1.id
      LEFT JOIN phone_book pb ON ml.phone = CONCAT(pb.country_code, pb.phone)
      LEFT JOIN contact_groups cg2 ON pb.group_id = cg2.id
      ORDER BY ml.timestamp DESC
    `);
    
    res.render('blast-logs', { 
      title: 'Log Blast Message',
      activePage: 'blast-logs',
      logs,
      loggedInInfo: loggedInInfo
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).send('Terjadi kesalahan saat mengambil data log');
  }
});

// Route untuk halaman Send Message
app.get('/send-message', isAuthenticated, (req, res) => {
  const status = req.query.status || '';
  res.render('send-message', { 
    title: 'Kirim Pesan Personal',
    activePage: 'send-message',
    status,
    loggedInInfo: loggedInInfo
  });
});

// Route untuk mengirim pesan personal
app.post('/send-message', isAuthenticated, upload.single('media'), async (req, res) => {
  const { message, country_code, phone, message_type } = req.body;
  const media = req.file;
  
  try {
    const fullPhone = country_code + phone;
    const chatId = fullPhone.includes('@c.us') ? fullPhone : `${fullPhone}@c.us`;

    // Cek status koneksi WhatsApp
    if (!client.pupPage) {
      return res.redirect('/send-message?status=not_connected');
    }

    // Buat log awal dengan status pending
    await dbPool.execute(
      `INSERT INTO message_logs (phone, message, message_type, media_url, media_name, status, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [fullPhone, message, message_type, media ? media.path : null, media ? media.originalname : null, 'pending']
    );

    try {
      // Update status menjadi processing
      await dbPool.execute(
        `UPDATE message_logs 
         SET status = 'processing' 
         WHERE phone = ? AND message = ? AND status = 'pending'`,
        [fullPhone, message]
      );

      let messageResponse;
      if (message_type === 'text') {
        messageResponse = await client.sendMessage(chatId, message);
      } else {
        const mediaMessage = MessageMedia.fromFilePath(media.path);
        
        // Tambahkan opsi khusus untuk setiap tipe media
        const options = { 
          caption: message,
          sendMediaAsDocument: message_type === 'document',
          sendVideoAsGif: false
        };

        // Tambahkan delay untuk video
        if (message_type === 'video') {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        messageResponse = await client.sendMessage(chatId, mediaMessage, options);
      }

      // Update status menjadi completed jika berhasil
      await dbPool.execute(
        `UPDATE message_logs 
         SET status = 'completed' 
         WHERE phone = ? AND message = ? AND status = 'processing'`,
        [fullPhone, message]
      );

      // Hapus file media jika ada
      if (media) {
        fs.unlinkSync(media.path);
      }

      res.redirect('/send-message?status=success');
    } catch (error) {
      console.error(`Gagal mengirim pesan ke ${fullPhone}:`, error);
      // Update status menjadi failed jika gagal
      await dbPool.execute(
        `UPDATE message_logs 
         SET status = 'failed' 
         WHERE phone = ? AND message = ? AND status = 'processing'`,
        [fullPhone, message]
      );
      res.redirect('/send-message?status=error');
    }
  } catch (err) {
    console.error('Error during send message:', err);
    return res.redirect('/send-message?status=error');
  }
});

// Route untuk halaman Auto Reply
app.get('/auto-reply', isAuthenticated, async (req, res) => {
  try {
    const [rules] = await dbPool.execute('SELECT * FROM auto_reply_rules ORDER BY created_at DESC');
    res.render('auto-reply', { 
      title: 'Auto Reply',
      activePage: 'auto-reply',
      rules,
      loggedInInfo: loggedInInfo
    });
  } catch (error) {
    console.error('Error fetching auto reply rules:', error);
    res.render('auto-reply', { 
      title: 'Auto Reply',
      activePage: 'auto-reply',
      rules: [],
      loggedInInfo: loggedInInfo
    });
  }
});

// Route untuk menambah rule auto reply
app.post('/auto-reply/add', isAuthenticated, upload.single('media'), async (req, res) => {
  const { keyword, keyword_type, sender_type, response_type, response_message, media_caption } = req.body;
  const media = req.file;
  
  try {
    await dbPool.execute(
      `INSERT INTO auto_reply_rules 
       (keyword, keyword_type, sender_type, response_type, response_message, media_url, media_caption) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        keyword, 
        keyword_type, 
        sender_type, 
        response_type,
        response_message,
        media ? media.path : null,
        media_caption
      ]
    );
    res.redirect('/auto-reply?status=success');
  } catch (error) {
    console.error('Error adding auto reply rule:', error);
    res.redirect('/auto-reply?status=error');
  }
});

// Route untuk menghapus rule
app.delete('/auto-reply/delete/:id', isAuthenticated, async (req, res) => {
  try {
    await dbPool.execute('DELETE FROM auto_reply_rules WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus rule' });
  }
});

// Event handler untuk pesan masuk
client.on('message', async msg => {
  try {
    // Ambil semua rules auto reply
    const [rules] = await dbPool.execute('SELECT * FROM auto_reply_rules');
    
    // Cek tipe chat (personal atau grup)
    const chat = await msg.getChat();
    const senderType = chat.isGroup ? 'group' : 'personal';
    
    // Cek setiap rule
    for (const rule of rules) {
      // Skip jika tidak sesuai dengan tipe pengirim
      if (rule.sender_type !== 'all' && rule.sender_type !== senderType) {
        continue;
      }
      
      // Cek keyword sesuai tipe
      let isMatch = false;
      if (rule.keyword_type === 'equal') {
        isMatch = msg.body.toLowerCase() === rule.keyword.toLowerCase();
      } else if (rule.keyword_type === 'contains') {
        isMatch = msg.body.toLowerCase().includes(rule.keyword.toLowerCase());
      }
      
      // Kirim balasan jika cocok
      if (isMatch) {
        await msg.reply(rule.response_message);
        break; // Hentikan pengecekan rule lain
      }
    }
  } catch (error) {
    console.error('Error in auto reply:', error);
  }
});

// Route untuk mendapatkan data rule
app.get('/auto-reply/:id', isAuthenticated, async (req, res) => {
  try {
    const [rows] = await dbPool.execute('SELECT * FROM auto_reply_rules WHERE id = ?', [req.params.id]);
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ error: 'Rule tidak ditemukan' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// Route untuk update rule
app.post('/auto-reply/update', isAuthenticated, upload.single('media'), async (req, res) => {
  const { rule_id, keyword, keyword_type, sender_type, response_type, response_message, media_caption } = req.body;
  const media = req.file;
  
  try {
    // Ambil data media lama jika ada
    const [oldRule] = await dbPool.execute('SELECT media_url FROM auto_reply_rules WHERE id = ?', [rule_id]);
    const oldMediaUrl = oldRule[0]?.media_url;
    
    // Update data rule
    await dbPool.execute(
      `UPDATE auto_reply_rules 
       SET keyword = ?, 
           keyword_type = ?, 
           sender_type = ?, 
           response_type = ?, 
           response_message = ?, 
           media_url = ?, 
           media_caption = ? 
       WHERE id = ?`,
      [
        keyword,
        keyword_type,
        sender_type,
        response_type,
        response_message,
        media ? media.path : oldMediaUrl,
        media_caption,
        rule_id
      ]
    );
    
    // Hapus file media lama jika ada media baru
    if (media && oldMediaUrl && fs.existsSync(oldMediaUrl)) {
      fs.unlinkSync(oldMediaUrl);
    }
    
    res.redirect('/auto-reply?status=updated');
  } catch (error) {
    console.error('Error updating auto reply rule:', error);
    res.redirect('/auto-reply?status=error');
  }
});