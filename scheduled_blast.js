const mysql = require("mysql2/promise");
const { MessageMedia } = require("whatsapp-web.js");
const cron = require("node-cron");
const fs = require("fs");

// Konfigurasi database pool
const dbPool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "huda_wagateway",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Export fungsi untuk digunakan di app.js
function initializeScheduler(whatsappClient) {
  console.log("Scheduler initialized");

  // Simpan client yang diterima dari parameter
  const client = whatsappClient;

  // Jalankan cron job setiap menit
  cron.schedule("* * * * *", async () => {
    try {
      // Ambil scheduled blast yang waktunya sudah tiba
      const [schedules] = await dbPool.execute(
        `SELECT * FROM blast_schedules 
         WHERE status = 'pending' 
         AND schedule_time <= NOW()`
      );

      for (const schedule of schedules) {
        // Update status menjadi processing
        await dbPool.execute(
          "UPDATE blast_schedules SET status = ? WHERE id = ?",
          ["processing", schedule.id]
        );

        // Ambil kontak dari grup
        const [contacts] = await dbPool.execute(
          `SELECT id, name, CONCAT(country_code,phone) AS phone 
           FROM phone_book 
           WHERE group_id = ?`,
          [schedule.group_id]
        );

        let messagesSent = 0;
        for (const contact of contacts) {
          const phone = contact.phone;
          const chatId = phone.includes("@c.us") ? phone : `${phone}@c.us`;

          try {
            let messageResponse;
            if (schedule.message_type === "text") {
              messageResponse = await client.sendMessage(
                chatId,
                schedule.message
              );
            } else {
              const mediaMessage = MessageMedia.fromFilePath(
                schedule.media_url
              );
              const options = {
                caption: schedule.message,
                sendMediaAsDocument: schedule.message_type === "document",
              };
              messageResponse = await client.sendMessage(
                chatId,
                mediaMessage,
                options
              );
            }

            // Saat memulai proses blast terjadwal
            await dbPool.execute(
              `INSERT INTO message_logs (phone, message, message_type, media_url, media_name, status, timestamp, blast_schedule_id) 
               VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
              [
                phone,
                schedule.message,
                schedule.message_type,
                schedule.media_url,
                schedule.media_name,
                "pending",
                schedule.id,
              ]
            );

            // Update status saat proses
            await dbPool.execute(
              `UPDATE message_logs SET status = 'processing' 
               WHERE blast_schedule_id = ? AND phone = ?`,
              [schedule.id, phone]
            );

            // Update status final (success/failed)
            await dbPool.execute(
              `UPDATE message_logs SET status = ? 
               WHERE blast_schedule_id = ? AND phone = ?`,
              ["completed", schedule.id, phone]
            );

            messagesSent++;
            if (messagesSent % 30 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 300000)); // 5 menit
            } else {
              const delay = Math.floor(Math.random() * 5000) + 10000; // 10-15 detik
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          } catch (error) {
            console.error(`Gagal mengirim pesan ke ${phone}:`, error);
            await dbPool.execute(
              `INSERT INTO message_logs (phone, message, message_type, media_url, media_name, status, timestamp) 
               VALUES (?, ?, ?, ?, ?, ?, NOW())`,
              [
                phone,
                schedule.message,
                schedule.message_type,
                schedule.media_url,
                schedule.media_name,
                "error",
              ]
            );
          }
        }

        // Update status menjadi completed
        await dbPool.execute(
          "UPDATE blast_schedules SET status = ? WHERE id = ?",
          ["completed", schedule.id]
        );

        // Hapus file media jika ada
        if (schedule.media_url) {
          fs.unlinkSync(schedule.media_url);
        }
      }
    } catch (error) {
      console.error("Error in scheduled blast:", error);
    }
  });
}

module.exports = { initializeScheduler };
