// app.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const app = express();
const port = 3000;

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

// Dummy user (ganti dengan validasi dari database bila perlu)
const users = [
  { id: 1, username: 'admin', password: 'admin' } // Password dalam contoh plain-text (gunakan hash untuk production)
];

// Konfigurasi Passport Local Strategy
passport.use(new LocalStrategy(
  function(username, password, done) {
    const user = users.find(u => u.username === username);
    if (!user) {
      return done(null, false, { message: 'Username tidak ditemukan.' });
    }
    if (user.password !== password) {
      return done(null, false, { message: 'Password salah.' });
    }
    return done(null, user);
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  const user = users.find(u => u.id === id);
  done(null, user);
});

// Inisialisasi database SQLite
const db = new sqlite3.Database('./database.db');
db.serialize(() => {
  // Tabel log pesan
  db.run(`CREATE TABLE IF NOT EXISTS message_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    message TEXT,
    status TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // Tabel phone book untuk menyimpan kontak
  db.run(`CREATE TABLE IF NOT EXISTS phone_book (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT
  )`);
});

// Inisialisasi WhatsApp client dengan LocalAuth agar sesi tersimpan
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true }
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
    loggedInInfo
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
app.get('/logs/data', isAuthenticated, (req, res) => {
  // Parameter dari DataTables
  const draw = parseInt(req.query.draw) || 1;
  const start = parseInt(req.query.start) || 0;
  const length = parseInt(req.query.length) || 10;
  const search = req.query.search.value;

  // Dapatkan total jumlah record
  db.get(`SELECT COUNT(*) as count FROM message_logs`, (err, countRow) => {
    if (err) {
      return res.json({ error: err.message });
    }
    const recordsTotal = countRow.count;

    if (search && search.trim() !== "") {
      // Filter dengan pencarian (contoh: mencari di kolom phone, message, atau status)
      const searchQuery = `%${search}%`;
      db.all(
        `SELECT * FROM message_logs 
         WHERE phone LIKE ? OR message LIKE ? OR status LIKE ?
         ORDER BY timestamp DESC
         LIMIT ? OFFSET ?`,
        [searchQuery, searchQuery, searchQuery, length, start],
        (err, rows) => {
          if (err) {
            return res.json({ error: err.message });
          }
          // Dapatkan jumlah record setelah filter
          db.get(
            `SELECT COUNT(*) as count FROM message_logs 
             WHERE phone LIKE ? OR message LIKE ? OR status LIKE ?`,
            [searchQuery, searchQuery, searchQuery],
            (err, filteredCountRow) => {
              if (err) {
                return res.json({ error: err.message });
              }
              const recordsFiltered = filteredCountRow.count;
              res.json({
                draw: draw,
                recordsTotal: recordsTotal,
                recordsFiltered: recordsFiltered,
                data: rows
              });
            }
          );
        }
      );
    } else {
      // Tanpa filter, kembalikan data langsung dengan LIMIT/OFFSET
      db.all(
        `SELECT * FROM message_logs 
         ORDER BY timestamp DESC 
         LIMIT ? OFFSET ?`,
        [length, start],
        (err, rows) => {
          if (err) {
            return res.json({ error: err.message });
          }
          res.json({
            draw: draw,
            recordsTotal: recordsTotal,
            recordsFiltered: recordsTotal,
            data: rows
          });
        }
      );
    }
  });
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
app.get('/phonebook/data', isAuthenticated, (req, res) => {
  // Parameter yang dikirimkan oleh DataTables
  const draw = parseInt(req.query.draw) || 1;
  const start = parseInt(req.query.start) || 0;
  const length = parseInt(req.query.length) || 10;
  const search = req.query.search.value;

  // Ambil total record
  db.get(`SELECT COUNT(*) as count FROM phone_book`, (err, countRow) => {
    if (err) {
      return res.json({ error: err.message });
    }
    const recordsTotal = countRow.count;

    if (search && search.trim() !== "") {
      const searchQuery = `%${search}%`;
      // Query untuk mencari dengan filter di kolom nama dan nomor
      db.all(
        `SELECT * FROM phone_book 
         WHERE name LIKE ? OR phone LIKE ? 
         ORDER BY name ASC 
         LIMIT ? OFFSET ?`,
        [searchQuery, searchQuery, length, start],
        (err, rows) => {
          if (err) {
            return res.json({ error: err.message });
          }
          // Hitung jumlah record yang sesuai dengan filter
          db.get(
            `SELECT COUNT(*) as count FROM phone_book 
             WHERE name LIKE ? OR phone LIKE ?`,
            [searchQuery, searchQuery],
            (err, filteredCountRow) => {
              if (err) {
                return res.json({ error: err.message });
              }
              const recordsFiltered = filteredCountRow.count;
              res.json({
                draw: draw,
                recordsTotal: recordsTotal,
                recordsFiltered: recordsFiltered,
                data: rows
              });
            }
          );
        }
      );
    } else {
      // Tanpa filter, ambil data langsung
      db.all(
        `SELECT * FROM phone_book 
         ORDER BY name ASC 
         LIMIT ? OFFSET ?`,
        [length, start],
        (err, rows) => {
          if (err) {
            return res.json({ error: err.message });
          }
          res.json({
            draw: draw,
            recordsTotal: recordsTotal,
            recordsFiltered: recordsTotal,
            data: rows
          });
        }
      );
    }
  });
});


app.post('/phonebook/add', isAuthenticated, (req, res) => {
  const { name, phone } = req.body;
  db.run(`INSERT INTO phone_book (name, phone) VALUES (?, ?)`, [name, phone], (err) => {
    if (err) {
      console.error(err);
    }
    res.redirect('/phonebook');
  });
});

// Route untuk halaman Blast (hanya untuk user yang sudah login)
app.get('/blast', isAuthenticated, (req, res) => {
  const status = req.query.status || '';
  res.render('blast', { 
    title: 'Blast Pesan',
    activePage: 'blast',
    status,
    loggedInInfo: loggedInInfo
  });
});

app.post('/blast', isAuthenticated, async (req, res) => {
  const { message } = req.body;
  db.all(`SELECT * FROM phone_book`, async (err, contacts) => {
    if (err) {
      console.error(err);
      return res.redirect('/blast?status=error');
    }
    if (!contacts || contacts.length === 0) {
      return res.redirect('/blast?status=noContacts');
    }
    
    const chunkSize = 10;
    for (let i = 0; i < contacts.length; i += chunkSize) {
      const batch = contacts.slice(i, i + chunkSize);
      
      await Promise.all(batch.map(async (contact) => {
        const phone = contact.phone;
        const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;
        try {
          await client.sendMessage(chatId, message);
          db.run(`INSERT INTO message_logs (phone, message, status) VALUES (?, ?, ?)`, [phone, message, 'success']);
        } catch (error) {
          console.error(`Gagal mengirim pesan ke ${phone}:`, error);
          db.run(`INSERT INTO message_logs (phone, message, status) VALUES (?, ?, ?)`, [phone, message, 'error']);
        }
      }));
      
      // Jeda 2 detik antar batch
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    res.redirect('/blast?status=done');
  });
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


// Route untuk mengirim pesan individual (hanya untuk user yang sudah login)
app.post('/send', isAuthenticated, (req, res) => {
  const { number, message } = req.body;
  const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
  client.sendMessage(chatId, message)
    .then(response => {
      db.run(`INSERT INTO message_logs (phone, message, status) VALUES (?, ?, ?)`, [number, message, 'success']);
      res.redirect('/?status=success');
    })
    .catch(err => {
      console.error('Gagal mengirim pesan:', err);
      db.run(`INSERT INTO message_logs (phone, message, status) VALUES (?, ?, ?)`, [number, message, 'error']);
      res.redirect('/?status=error');
    });
});

// Jalankan server Express
app.listen(port, () => {
  console.log(`Dashboard berjalan pada http://localhost:${port}`);
});
