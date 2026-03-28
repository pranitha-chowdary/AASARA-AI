require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');

// Connect to MongoDB using the URI from .env
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB. Clearing database...");
    
    // Get all collections
    const collections = await mongoose.connection.db.collections();
    
    // Drop each collection
    for (let collection of collections) {
      await collection.drop();
      console.log(`Dropped collection: ${collection.collectionName}`);
    }
    
    console.log("Database cleared successfully!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Connection error:", err);
    process.exit(1);
  });
