require('dotenv').config();
const mongoose = require('mongoose');
const Users = require('../api/users/users.model');

// Use the same mongoose configuration from your main app
require('../config/mongoose')(mongoose);

async function updateAllUsers() {
  try {
    // Get all users
    const users = await Users.find({});
    console.log(`Found ${users.length} users to update`);

    let activeCount = 0;
    let pendingCount = 0;
    let inactiveCount = 0;

    // Update each user
    for (const user of users) {
      let newStatus;
      if (user.active && user.validateHash?.hash === null) {
        newStatus = 'active';
        activeCount++;
      } else if (user.active && user.validateHash?.hash !== null) {
        newStatus = 'pending';
        pendingCount++;
      } else {
        newStatus = 'inactive';
        inactiveCount++;
      }

      await Users.findByIdAndUpdate(
        user._id,
        { $set: { status: newStatus } },
        { new: true, runValidators: false }
      );
    }

    console.log('Update Results:');
    console.log('Active users updated:', activeCount);
    console.log('Pending users updated:', pendingCount);
    console.log('Inactive users updated:', inactiveCount);
    console.log('Total users updated:', activeCount + pendingCount + inactiveCount);

    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error updating users:', error);
    process.exit(1);
  }
}

updateAllUsers(); 