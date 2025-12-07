-- GCCI Giftstore System - Complete Database Schema
-- Generated: December 2, 2025
-- This script creates all tables with proper foreign key constraints

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS `payment`;
DROP TABLE IF EXISTS `purchase_items`;
DROP TABLE IF EXISTS `purchase`;
DROP TABLE IF EXISTS `reservation_item`;
DROP TABLE IF EXISTS `reservation`;
DROP TABLE IF EXISTS `enrolled_students`;
DROP TABLE IF EXISTS `student`;
DROP TABLE IF EXISTS `Inventory_Transaction`;
DROP TABLE IF EXISTS `item_variant`;
DROP TABLE IF EXISTS `item`;
DROP TABLE IF EXISTS `category`;
DROP TABLE IF EXISTS `admin`;
DROP TABLE IF EXISTS `ai_analysis_log`;

-- =====================================================
-- ADMIN TABLE
-- =====================================================
CREATE TABLE `admin` (
  `AdminID` INT NOT NULL AUTO_INCREMENT,
  `Username` VARCHAR(64) NOT NULL UNIQUE,
  `PasswordHash` VARCHAR(255) NOT NULL,
  `Role` VARCHAR(32) NOT NULL DEFAULT 'admin',
  `IsActive` TINYINT NOT NULL DEFAULT 1,
  `DateCreated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `LastLoginAt` DATETIME NULL,
  PRIMARY KEY (`AdminID`),
  UNIQUE KEY `idx_admin_username` (`Username`),
  KEY `idx_admin_role` (`Role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CATEGORY TABLE
-- =====================================================
CREATE TABLE `category` (
  `CategoryID` INT NOT NULL AUTO_INCREMENT,
  `CategoryName` VARCHAR(100) NOT NULL,
  `AdminID` INT NULL,
  `DateCreated` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`CategoryID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ITEM TABLE (Products)
-- =====================================================
CREATE TABLE `item` (
  `ItemID` INT NOT NULL AUTO_INCREMENT,
  `ItemName` VARCHAR(100) NOT NULL,
  `Description` TEXT NULL,
  `Price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `StockQuantity` INT NOT NULL DEFAULT 0,
  `IsActive` TINYINT(1) NOT NULL DEFAULT 1,
  `CategoryID` INT NULL,
  `ImagePath` VARCHAR(255) NULL,
  PRIMARY KEY (`ItemID`),
  KEY `idx_item_category` (`CategoryID`),
  KEY `idx_item_active` (`IsActive`),
  CONSTRAINT `fk_item_category` FOREIGN KEY (`CategoryID`) 
    REFERENCES `category` (`CategoryID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ITEM_VARIANT TABLE
-- =====================================================
CREATE TABLE `item_variant` (
  `VariantID` INT NOT NULL AUTO_INCREMENT,
  `ItemID` INT NOT NULL,
  `Size` VARCHAR(32) NOT NULL,
  `Price` DECIMAL(10,2) NULL,
  `StockQuantity` INT NOT NULL DEFAULT 0,
  `IsActive` TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`VariantID`),
  KEY `idx_variant_item` (`ItemID`),
  KEY `idx_variant_size` (`Size`),
  CONSTRAINT `fk_variant_item` FOREIGN KEY (`ItemID`) 
    REFERENCES `item` (`ItemID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- STUDENT TABLE
-- =====================================================
CREATE TABLE `student` (
  `StudentID` INT NOT NULL AUTO_INCREMENT,
  `FullName` VARCHAR(100) NOT NULL,
  `Email` VARCHAR(100) NOT NULL UNIQUE,
  `StudentIDNumber` VARCHAR(50) NOT NULL UNIQUE,
  PRIMARY KEY (`StudentID`),
  UNIQUE KEY `idx_student_email` (`Email`),
  UNIQUE KEY `idx_student_id_number` (`StudentIDNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ENROLLED_STUDENTS TABLE
-- =====================================================
CREATE TABLE `enrolled_students` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `school_id` VARCHAR(50) NOT NULL UNIQUE,
  `full_name` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_enrolled_school_id` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- RESERVATION TABLE
-- =====================================================
CREATE TABLE `reservation` (
  `ReservationID` INT NOT NULL AUTO_INCREMENT,
  `ReservationCode` VARCHAR(50) NOT NULL,
  `StudentID` INT NOT NULL,
  `Status` ENUM('Pending','Approved','Claimed','Expired','Canceled') NOT NULL,
  `DateReserved` DATETIME NOT NULL,
  `CancelWindowExpires` DATETIME NOT NULL,
  PRIMARY KEY (`ReservationID`),
  KEY `idx_reservation_code` (`ReservationCode`),
  KEY `idx_reservation_student` (`StudentID`),
  KEY `idx_reservation_status` (`Status`),
  CONSTRAINT `fk_reservation_student` FOREIGN KEY (`StudentID`) 
    REFERENCES `student` (`StudentID`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- RESERVATION_ITEM TABLE
-- =====================================================
CREATE TABLE `reservation_item` (
  `ResItemID` INT NOT NULL AUTO_INCREMENT,
  `ReservationID` INT NOT NULL,
  `ItemVariantID` INT NOT NULL,
  `Quantity` INT NOT NULL,
  PRIMARY KEY (`ResItemID`),
  KEY `idx_resitem_reservation` (`ReservationID`),
  KEY `idx_resitem_variant` (`ItemVariantID`),
  CONSTRAINT `fk_resitem_reservation` FOREIGN KEY (`ReservationID`) 
    REFERENCES `reservation` (`ReservationID`) ON DELETE CASCADE,
  CONSTRAINT `fk_resitem_variant` FOREIGN KEY (`ItemVariantID`) 
    REFERENCES `item_variant` (`VariantID`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PURCHASE TABLE
-- =====================================================
CREATE TABLE `purchase` (
  `PurchaseID` INT NOT NULL AUTO_INCREMENT,
  `ReservationID` INT NULL,
  `PurchaseType` ENUM('Reservation','Onsite') NOT NULL,
  `DatePurchased` DATETIME NOT NULL,
  `TotalAmount` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`PurchaseID`),
  KEY `idx_purchase_reservation` (`ReservationID`),
  KEY `idx_purchase_type` (`PurchaseType`),
  CONSTRAINT `fk_purchase_reservation` FOREIGN KEY (`ReservationID`) 
    REFERENCES `reservation` (`ReservationID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PURCHASE_ITEMS TABLE
-- =====================================================
CREATE TABLE `purchase_items` (
  `PurchaseItemID` INT NOT NULL AUTO_INCREMENT,
  `PurchaseID` INT NOT NULL,
  `ItemID` INT NOT NULL,
  `VariantID` INT NULL,
  `Quantity` INT NOT NULL,
  `PriceAtPurchase` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`PurchaseItemID`),
  KEY `idx_purchitem_purchase` (`PurchaseID`),
  KEY `idx_purchitem_item` (`ItemID`),
  KEY `idx_purchitem_variant` (`VariantID`),
  CONSTRAINT `fk_purchitem_purchase` FOREIGN KEY (`PurchaseID`) 
    REFERENCES `purchase` (`PurchaseID`) ON DELETE CASCADE,
  CONSTRAINT `fk_purchitem_item` FOREIGN KEY (`ItemID`) 
    REFERENCES `item` (`ItemID`) ON DELETE RESTRICT,
  CONSTRAINT `fk_purchitem_variant` FOREIGN KEY (`VariantID`) 
    REFERENCES `item_variant` (`VariantID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PAYMENT TABLE
-- =====================================================
CREATE TABLE `payment` (
  `PaymentID` INT NOT NULL AUTO_INCREMENT,
  `PurchaseID` INT NOT NULL,
  `PaymentRef` VARCHAR(100) NOT NULL,
  `AmountPaid` DECIMAL(10,2) NOT NULL,
  `PaymentStatus` ENUM('Pending','Confirmed','Rejected') NOT NULL,
  `PaymentDate` DATETIME NOT NULL,
  PRIMARY KEY (`PaymentID`),
  KEY `idx_payment_purchase` (`PurchaseID`),
  KEY `idx_payment_status` (`PaymentStatus`),
  CONSTRAINT `fk_payment_purchase` FOREIGN KEY (`PurchaseID`) 
    REFERENCES `purchase` (`PurchaseID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- INVENTORY_TRANSACTION TABLE
-- =====================================================
CREATE TABLE `Inventory_Transaction` (
  `TxID` INT NOT NULL AUTO_INCREMENT,
  `ItemID` INT NOT NULL,
  `VariantID` INT NULL,
  `QuantityChange` INT NOT NULL,
  `Type` VARCHAR(50) NOT NULL,
  `Reference` VARCHAR(255) NULL,
  `Date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `AdminID` INT NULL,
  PRIMARY KEY (`TxID`),
  KEY `idx_invtx_item` (`ItemID`),
  KEY `idx_invtx_variant` (`VariantID`),
  KEY `idx_invtx_type` (`Type`),
  KEY `idx_invtx_date` (`Date`),
  CONSTRAINT `fk_invtx_item` FOREIGN KEY (`ItemID`) 
    REFERENCES `item` (`ItemID`) ON DELETE RESTRICT,
  CONSTRAINT `fk_invtx_variant` FOREIGN KEY (`VariantID`) 
    REFERENCES `item_variant` (`VariantID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- AI_ANALYSIS_LOG TABLE (Optional - for AI features)
-- =====================================================
CREATE TABLE `ai_analysis_log` (
  `LogID` INT NOT NULL AUTO_INCREMENT,
  `AnalysisType` VARCHAR(100) NOT NULL,
  `DateAnalyzed` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `DataSnapshot` TEXT NULL,
  `AIResponse` TEXT NULL,
  `Status` VARCHAR(50) NOT NULL,
  `ErrorMessage` TEXT NULL,
  PRIMARY KEY (`LogID`),
  KEY `idx_ailog_type` (`AnalysisType`),
  KEY `idx_ailog_date` (`DateAnalyzed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SAMPLE DATA (Optional)
-- =====================================================

-- Insert default admin (password: admin123)
-- Note: Use bcrypt to hash passwords in production
INSERT INTO `admin` (`Username`, `PasswordHash`, `Role`) VALUES
('admin', '$2b$10$YourHashedPasswordHere', 'admin'),
('superuser', '$2b$10$YourHashedPasswordHere', 'superuser');

-- Insert sample categories
INSERT INTO `category` (`CategoryName`) VALUES
('Apparel'),
('Accessories'),
('School Supplies'),
('Merchandise');

-- =====================================================
-- NOTES
-- =====================================================
-- 1. Remember to update admin passwords using bcrypt
-- 2. Adjust AUTO_INCREMENT starting values as needed
-- 3. Run this script in your MySQL database
-- 4. Make sure to backup existing data before recreating
-- 5. Foreign key constraints enforce referential integrity
-- 
-- CASCADE: Automatically delete child records
-- RESTRICT: Prevent deletion if child records exist
-- SET NULL: Set foreign key to NULL when parent is deleted
