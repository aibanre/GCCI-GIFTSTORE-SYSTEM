const { sequelize } = require('./models');

async function checkReservations() {
    try {
        const [rows] = await sequelize.query(`
            SELECT r.StudentID, r.ReservationCode, r.Status, r.DateReserved, s.Email, s.StudentIDNumber
            FROM reservation r
            LEFT JOIN student s ON r.StudentID = s.StudentID
            ORDER BY r.DateReserved DESC
            LIMIT 10
        `);
        
        console.log('\n=== Recent Reservations ===\n');
        console.table(rows);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkReservations();
