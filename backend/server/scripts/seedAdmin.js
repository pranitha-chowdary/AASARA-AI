require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('../models/schemas');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB. Seeding admin user...");
    
    const hashedPassword = await bcrypt.hash('admin123456', 10);
    const adminUser = new User({
      fullName: 'Aasara Admin',
      email: 'admin@aasara.ai',
      password: hashedPassword,
      phoneNumber: '0000000000',
      role: 'admin',
      city: 'Hyderabad',
      policyActive: false,
    });
    
    await adminUser.save();
    console.log("Admin user seeded successfully!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Connection error:", err);
    process.exit(1);
  });
