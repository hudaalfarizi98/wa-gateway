/*
SQLyog Community v13.2.1 (64 bit)
MySQL - 10.6.17-MariaDB-log : Database - huda_wagateway
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`huda_wagateway` /*!40100 DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci */;

USE `huda_wagateway`;

/*Table structure for table `auto_reply_rules` */

DROP TABLE IF EXISTS `auto_reply_rules`;

CREATE TABLE `auto_reply_rules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `keyword` varchar(255) NOT NULL,
  `keyword_type` enum('equal','contains') NOT NULL,
  `sender_type` enum('all','personal','group') NOT NULL,
  `response_message` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `response_type` enum('text','image','document','video','voice') NOT NULL DEFAULT 'text',
  `media_url` varchar(255) DEFAULT NULL,
  `media_caption` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Data for the table `auto_reply_rules` */

insert  into `auto_reply_rules`(`id`,`keyword`,`keyword_type`,`sender_type`,`response_message`,`created_at`,`response_type`,`media_url`,`media_caption`) values 
(1,'salam','contains','all','Waalaikumussalam warahmatullahi wabarakatuh.\r\nAda yang bisa kami bantu?','2025-05-21 16:50:55','text',NULL,''),
(2,'siang','contains','all','Selamat Siang.\r\nAda yang bisa kami bantu?','2025-05-22 08:18:44','text',NULL,''),
(3,'pagi','contains','all','Selamat Pagi. Ada yang bisa kami bantu?','2025-05-22 08:19:23','text',NULL,''),
(4,'malam','contains','all','Selamat Malam.\r\nAda yang bisa kami bantu?','2025-05-22 08:19:50','text',NULL,''),
(5,'tagihan','contains','all','Untuk informasi silahkan balas dengan kode Angka dibawah ini:\r\n1. Informasi Tagihan\r\n2. Keluhan Jaringan','2025-05-22 08:22:09','text',NULL,''),
(6,'1','equal','all','Tagihan Anda Bulan Ini Adalah:','2025-05-22 08:23:25','text',NULL,'');

/*Table structure for table `blast_schedules` */

DROP TABLE IF EXISTS `blast_schedules`;

CREATE TABLE `blast_schedules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `message` text NOT NULL,
  `message_type` enum('text','image','document','video','voice') NOT NULL DEFAULT 'text',
  `media_url` varchar(255) DEFAULT NULL,
  `media_name` varchar(255) DEFAULT NULL,
  `schedule_time` datetime NOT NULL,
  `status` enum('pending','processing','completed','failed') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `group_id` (`group_id`),
  CONSTRAINT `blast_schedules_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `contact_groups` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Data for the table `blast_schedules` */

insert  into `blast_schedules`(`id`,`group_id`,`message`,`message_type`,`media_url`,`media_name`,`schedule_time`,`status`,`created_at`) values 
(3,2,'gambar lagi tes','document','uploads\\1747734568977-aisyah_snack.png','aisyah_snack.png','2025-05-20 16:50:00','completed','2025-05-20 16:49:29'),
(4,2,'tes kirim gambar','document','uploads\\1747734743972-aisyah_snack.png','aisyah_snack.png','2025-05-20 16:53:00','completed','2025-05-20 16:52:24'),
(5,2,'coba kirim gambar','document','uploads\\1747734994865-imisca-white.png','imisca-white.png','2025-05-20 16:57:00','completed','2025-05-20 16:56:34'),
(6,3,'text jadwal','text',NULL,NULL,'2025-05-21 10:19:00','completed','2025-05-21 10:18:08'),
(7,3,'gambar jadwal','image','uploads\\1747797589792-Group 323.png','Group 323.png','2025-05-21 10:20:00','completed','2025-05-21 10:19:49'),
(8,3,'dokumen jadwal','document','uploads\\1747797637955-Group 323.png','Group 323.png','2025-05-21 10:21:00','completed','2025-05-21 10:20:37');

/*Table structure for table `contact_groups` */

DROP TABLE IF EXISTS `contact_groups`;

CREATE TABLE `contact_groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Data for the table `contact_groups` */

insert  into `contact_groups`(`id`,`name`,`created_at`) values 
(1,'Wilayah Cikarang','2025-05-18 05:46:26'),
(2,'Wilayah Pondok Gede','2025-05-18 05:48:42'),
(3,'Pribadi','2025-05-21 08:24:19');

/*Table structure for table `message_logs` */

DROP TABLE IF EXISTS `message_logs`;

CREATE TABLE `message_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `phone` varchar(16) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `timestamp` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `message_type` enum('text','image','document','video','voice') NOT NULL DEFAULT 'text',
  `media_url` varchar(255) DEFAULT NULL,
  `media_name` varchar(255) DEFAULT NULL,
  `blast_schedule_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `blast_schedule_id` (`blast_schedule_id`),
  CONSTRAINT `message_logs_ibfk_1` FOREIGN KEY (`blast_schedule_id`) REFERENCES `blast_schedules` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Data for the table `message_logs` */

insert  into `message_logs`(`id`,`phone`,`message`,`status`,`timestamp`,`created_at`,`updated_at`,`message_type`,`media_url`,`media_name`,`blast_schedule_id`) values 
(13,'6285369919039','cobain kirim dengan status pending, processing, complete, failed','completed','2025-05-20 13:28:23','2025-05-20 13:28:23','2025-05-20 13:28:23','text',NULL,NULL,NULL),
(14,'628988327569','cobain kirim dengan status pending, processing, complete, failed','completed','2025-05-20 13:28:23','2025-05-20 13:28:23','2025-05-20 13:28:35','text',NULL,NULL,NULL),
(15,'6289601568504','coba liat ini coy','failed','2025-05-20 16:29:08','2025-05-20 16:29:08','2025-05-20 16:29:13','video','uploads\\1747733348325-Intro Template.mp4','Intro Template.mp4',NULL),
(16,'6289601568504','coy ini gue adit','completed','2025-05-20 16:32:15','2025-05-20 16:32:15','2025-05-20 16:32:15','text',NULL,NULL,NULL),
(17,'6289601568504','oke ditunggu','completed','2025-05-20 16:45:31','2025-05-20 16:45:31','2025-05-20 16:45:31','text',NULL,NULL,NULL),
(18,'628988327569','coba kirim video','failed','2025-05-20 16:46:22','2025-05-20 16:46:22','2025-05-20 16:46:29','video','uploads\\1747734382294-Intro Template.mp4','Intro Template.mp4',NULL),
(19,'628988327569','coba kirim pesan personal','completed','2025-05-20 16:47:22','2025-05-20 16:47:22','2025-05-20 16:47:22','image','uploads\\1747734442033-imisca-white.png','imisca-white.png',NULL),
(20,'62895332000896','gambar lagi tes','error','2025-05-20 16:50:00','2025-05-20 16:50:00',NULL,'document','uploads\\1747734568977-aisyah_snack.png','aisyah_snack.png',NULL),
(21,'6283826744877','gambar lagi tes','error','2025-05-20 16:50:00','2025-05-20 16:50:00',NULL,'document','uploads\\1747734568977-aisyah_snack.png','aisyah_snack.png',NULL),
(22,'62895332000896','tes kirim gambar','error','2025-05-20 16:53:00','2025-05-20 16:53:00',NULL,'document','uploads\\1747734743972-aisyah_snack.png','aisyah_snack.png',NULL),
(23,'6283826744877','tes kirim gambar','error','2025-05-20 16:53:00','2025-05-20 16:53:00',NULL,'document','uploads\\1747734743972-aisyah_snack.png','aisyah_snack.png',NULL),
(24,'62895332000896','coba kirim gambar','processing','2025-05-20 16:57:00','2025-05-20 16:57:00','2025-05-20 16:57:00','document','uploads\\1747734994865-imisca-white.png','imisca-white.png',5),
(25,'62895332000896','coba kirim gambar','error','2025-05-20 16:57:00','2025-05-20 16:57:00',NULL,'document','uploads\\1747734994865-imisca-white.png','imisca-white.png',NULL),
(26,'6283826744877','coba kirim gambar','processing','2025-05-20 16:57:00','2025-05-20 16:57:00','2025-05-20 16:57:00','document','uploads\\1747734994865-imisca-white.png','imisca-white.png',5),
(27,'6283826744877','coba kirim gambar','error','2025-05-20 16:57:00','2025-05-20 16:57:00',NULL,'document','uploads\\1747734994865-imisca-white.png','imisca-white.png',NULL),
(28,'6289601568504','gue ngirim text tanpa jadwal','completed','2025-05-21 08:25:08','2025-05-21 08:25:08','2025-05-21 08:25:08','text',NULL,NULL,NULL),
(29,'6289601568504','sama ngirim media gambar tanpa jadwal','completed','2025-05-21 08:27:35','2025-05-21 08:27:35','2025-05-21 08:27:36','image','uploads\\1747790855558-MiscaMockup.png','MiscaMockup.png',NULL),
(30,'6289601568504','ini media dokumen tanpa jadwal','completed','2025-05-21 08:36:15','2025-05-21 08:36:15','2025-05-21 08:36:16','document','uploads\\1747791375195-Splash Screen.png','Splash Screen.png',NULL),
(31,'6289601568504','ini vidio intro tanpa jadwal','failed','2025-05-21 08:50:49','2025-05-21 08:50:49','2025-05-21 08:50:57','video','uploads\\1747792249762-Intro Template.mp4','Intro Template.mp4',NULL),
(32,'6289601568504','ini coba kirim video tanpa jadwal','failed','2025-05-21 08:59:06','2025-05-21 08:59:06','2025-05-21 08:59:10','video','uploads\\1747792746648-video coba ya.mp4','video coba ya.mp4',NULL),
(33,'6289601568504','coba vidio tanpa jadwal','completed','2025-05-21 09:03:06','2025-05-21 09:03:06','2025-05-21 09:03:15','video','uploads\\1747792986967-video coba ya.mp4','video coba ya.mp4',NULL),
(34,'6289601568504','coba kirim lagi vidio tanpa jadwal','failed','2025-05-21 09:12:49','2025-05-21 09:12:49','2025-05-21 09:12:57','video','uploads\\1747793569309-dummyvideo.mp4','dummyvideo.mp4',NULL),
(35,'6289601568504','iya','completed','2025-05-21 09:22:52','2025-05-21 09:22:52','2025-05-21 09:22:53','image','uploads\\1747794172130-Group 323.png','Group 323.png',NULL),
(36,'6289601568504','Kirim video','failed','2025-05-21 09:33:45','2025-05-21 09:33:45','2025-05-21 09:33:46','video','uploads\\1747794825944-dummyvideo.mp4','dummyvideo.mp4',NULL),
(37,'6289601568504','iya cobain coy','completed','2025-05-21 10:01:40','2025-05-21 10:01:40','2025-05-21 10:01:40','text',NULL,NULL,NULL),
(38,'6289601568504','cobain','failed','2025-05-21 10:04:20','2025-05-21 10:04:20','2025-05-21 10:04:21','video','uploads\\1747796660831-dummyvideo.mp4','dummyvideo.mp4',NULL),
(39,'6289601568504','text jadwal','completed','2025-05-21 10:19:00','2025-05-21 10:19:00','2025-05-21 10:19:00','text',NULL,NULL,6),
(40,'6289601568504','gambar jadwal','completed','2025-05-21 10:20:04','2025-05-21 10:20:04','2025-05-21 10:20:04','image','uploads\\1747797589792-Group 323.png','Group 323.png',7),
(41,'6289601568504','dokumen jadwal','completed','2025-05-21 10:21:00','2025-05-21 10:21:00','2025-05-21 10:21:00','document','uploads\\1747797637955-Group 323.png','Group 323.png',8),
(42,'6289601568504','coba ya','completed','2025-05-21 10:21:41','2025-05-21 10:21:41','2025-05-21 10:21:41','text',NULL,NULL,NULL),
(43,'6289601568504','gambar kirim','completed','2025-05-21 10:22:00','2025-05-21 10:22:00','2025-05-21 10:22:03','image','uploads\\1747797720599-WhatsApp_Image_2025-05-05_at_09.48.37-removebg-preview 1 (1).png','WhatsApp_Image_2025-05-05_at_09.48.37-removebg-preview 1 (1).png',NULL),
(44,'6289601568504','dokumen kirim','completed','2025-05-21 10:22:24','2025-05-21 10:22:24','2025-05-21 10:22:24','document','uploads\\1747797744066-mobile-mockup-gray.png','mobile-mockup-gray.png',NULL),
(45,'6289601568504','vidio','failed','2025-05-21 10:22:39','2025-05-21 10:22:39','2025-05-21 10:22:42','video','uploads\\1747797759380-dummyvideo.mp4','dummyvideo.mp4',NULL);

/*Table structure for table `phone_book` */

DROP TABLE IF EXISTS `phone_book`;

CREATE TABLE `phone_book` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `country_code` varchar(3) DEFAULT NULL,
  `phone` varchar(16) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `group_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Data for the table `phone_book` */

insert  into `phone_book`(`id`,`name`,`country_code`,`phone`,`created_at`,`updated_at`,`group_id`) values 
(17,'Rini Rahayu','62','85369919039','2025-05-15 11:14:50','2025-05-20 08:10:43',1),
(23,'Huda Alfarizi','62','8988327569','2025-05-20 08:18:58',NULL,1),
(24,'Ibu','62','895332000896','2025-05-20 08:19:29',NULL,2),
(25,'Bapak','62','83826744877','2025-05-20 08:19:54',NULL,2),
(26,'Saya Sendiri','62','89601568504','2025-05-21 08:24:36',NULL,3);

/*Table structure for table `users` */

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) DEFAULT NULL,
  `fullname` varchar(100) DEFAULT NULL,
  `password` varchar(200) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

/*Data for the table `users` */

insert  into `users`(`id`,`username`,`fullname`,`password`,`created_at`,`updated_at`) values 
(1,'admin','Aditya Widiatmoko','admin123','2025-05-15 08:17:10','2025-05-15 08:18:31');

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
