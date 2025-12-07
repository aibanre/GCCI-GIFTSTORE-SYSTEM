const express = require('express');
const path = require('path');
const app = express();
const cookieParser = require('cookie-parser');
const config = require('./config/config.json')[process.env.NODE_ENV || 'development'];

let db;
try {
  db = require('./models');
  console.log('Database models loaded successfully');
} catch (err) {
  console.error('Warning: Failed to load database models:', err.message);
  db = null;
}

app.set('view engine', 'ejs');
// set explicit views folder (optional if default ./views is used)
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Make db available to route handlers
app.use((req, res, next) => {
  req.db = db;
  next();
});

app.use(require('./router/web'));

// Expose superuserSecret (prefer env override)
app.set('superuserSecret', process.env.SUPERUSER_SECRET || config.superuserSecret || 'CHANGE_ME_SUPER');
// Expose imgbb API key for client usage (prefer env override). Only used by admin-protected client endpoint.
app.set('imgbbApiKey', process.env.IMGBB_API_KEY || config.imgbbApiKey || '');
// AI provider configuration (server should keep API keys secret). You can set via env or in config.json under 'aiApiUrl'/'aiApiKey'
app.set('aiApiUrl', process.env.AI_API_URL || config.aiApiUrl || '');
app.set('aiApiKey', process.env.AI_API_KEY || config.aiApiKey || '');
// Which model to use for providers that require it (e.g. Google Gemini model name)
app.set('aiModel', process.env.AI_MODEL || config.aiModel || 'models/gemini-1.0');

app.listen(3000, () => {
    console.log('Server is running on port 3000');
    
    // Start background jobs
    if (db) {
        startClaimDeadlineEmailJob();
        startAutoExpireReservationsJob();
    }
});

// Background job to send claim deadline emails after cancel window expires
function startClaimDeadlineEmailJob() {
    const { sendClaimDeadlineEmail } = require('./config/emailService');
    
    // Run every 5 minutes
    const checkInterval = 5 * 60 * 1000; // 5 minutes
    console.log('[ClaimDeadlineJob] Started - checking every 5 minutes');
    
    setInterval(async () => {
        try {
            const now = new Date();
            
            // Find reservations where cancel window just expired (within last 5 minutes)
            // and status is still Pending
            const fiveMinutesAgo = new Date(now.getTime() - checkInterval);
            const { Op } = require('sequelize');
            
            const reservations = await db.Reservation.findAll({
                where: {
                    Status: 'Pending',
                    CancelWindowExpires: {
                        [Op.lte]: now,
                        [Op.gte]: fiveMinutesAgo
                    }
                },
                raw: true
            });
            
            console.log(`[ClaimDeadlineJob] Found ${reservations.length} reservations ready to claim`);
            
            for (const reservation of reservations) {
                try {
                    // Get student info
                    const student = await db.Student.findByPk(reservation.StudentID);
                    if (!student || !student.Email || !student.Email.includes('@') || student.Email.includes('guest+')) {
                        continue; // Skip guest or invalid emails
                    }
                    
                    // Get reservation items
                    const resItems = await db.Reservation_Item.findAll({
                        where: { ReservationID: reservation.ReservationID },
                        raw: true
                    });
                    
                    const itemIds = resItems.map(i => i.ItemID).filter(Boolean);
                    const items = await db.Item.findAll({
                        where: { ItemID: { [Op.in]: itemIds } },
                        raw: true
                    });
                    
                    const itemMap = {};
                    items.forEach(item => { itemMap[item.ItemID] = item; });
                    
                    const emailItems = resItems.map(ri => ({
                        productName: itemMap[ri.ItemID]?.ItemName || 'Product',
                        variantName: '',
                        quantity: ri.Quantity
                    }));
                    
                    // Send claim deadline email
                    await sendClaimDeadlineEmail(student.Email, {
                        reservationCode: reservation.ReservationCode,
                        studentName: student.FullName || 'Guest',
                        items: emailItems,
                        claimDeadline: reservation.ClaimDeadline
                    });
                    
                    console.log(`[ClaimDeadlineJob] Sent claim email for ${reservation.ReservationCode}`);
                } catch (err) {
                    console.error(`[ClaimDeadlineJob] Error processing reservation ${reservation.ReservationID}:`, err);
                }
            }
        } catch (err) {
            console.error('[ClaimDeadlineJob] Job error:', err);
        }
    }, checkInterval);
}

// Background job to auto-expire reservations past claim deadline
function startAutoExpireReservationsJob() {
    // Run every 30 minutes
    const checkInterval = 30 * 60 * 1000;
    console.log('[AutoExpireJob] Started - checking every 30 minutes');
    
    setInterval(async () => {
        try {
            const now = new Date();
            const { Op } = require('sequelize');
            
            // Find reservations where claim deadline has passed and still pending/approved
            const expiredReservations = await db.Reservation.findAll({
                where: {
                    Status: { [Op.in]: ['Pending', 'Approved'] },
                    ClaimDeadline: {
                        [Op.lt]: now
                    }
                },
                raw: true
            });
            
            console.log(`[AutoExpireJob] Found ${expiredReservations.length} expired reservations`);
            
            for (const reservation of expiredReservations) {
                try {
                    // Update status to Expired
                    await db.Reservation.update(
                        { Status: 'Expired' },
                        { where: { ReservationID: reservation.ReservationID } }
                    );
                    
                    // Restore stock
                    const resItems = await db.Reservation_Item.findAll({
                        where: { ReservationID: reservation.ReservationID },
                        raw: true
                    });
                    
                    for (const item of resItems) {
                        const itemRecord = await db.Item.findByPk(item.ItemID);
                        if (itemRecord) {
                            await itemRecord.update({ 
                                StockQuantity: itemRecord.StockQuantity + item.Quantity 
                            });
                            
                            // Log inventory transaction
                            if (db.Inventory_Transaction) {
                                await db.Inventory_Transaction.create({
                                    ItemID: item.ItemID,
                                    QuantityChange: item.Quantity,
                                    Type: 'Restock',
                                    Reference: `Reservation ${reservation.ReservationCode} expired - Stock restored`,
                                    AdminID: null,
                                    Date: new Date()
                                });
                            }
                        }
                    }
                    
                    console.log(`[AutoExpireJob] Expired reservation ${reservation.ReservationCode} and restored stock`);
                } catch (err) {
                    console.error(`[AutoExpireJob] Error processing reservation ${reservation.ReservationID}:`, err);
                }
            }
        } catch (err) {
            console.error('[AutoExpireJob] Job error:', err);
        }
    }, checkInterval);
}