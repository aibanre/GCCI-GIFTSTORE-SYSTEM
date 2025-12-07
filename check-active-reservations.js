const { sequelize, Student, Reservation } = require('./models');

async function checkStudent() {
    try {
        const { Op } = require('sequelize');
        
        // Get the most recent student (assuming you're testing with this one)
        const [students] = await sequelize.query(`
            SELECT * FROM student ORDER BY StudentID DESC LIMIT 5
        `);
        
        console.log('\n=== Recent Students ===\n');
        console.table(students);
        
        // Check for active reservations
        for (const student of students) {
            const [activeReservations] = await sequelize.query(`
                SELECT * FROM reservation 
                WHERE StudentID = ${student.StudentID}
                AND Status IN ('Pending', 'Approved')
            `);
            
            if (activeReservations.length > 0) {
                console.log(`\nStudent ${student.StudentIDNumber} has ACTIVE reservations:`);
                console.table(activeReservations);
            }
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkStudent();
