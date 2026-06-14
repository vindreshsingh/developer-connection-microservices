import mongoose from 'mongoose';

// Each service connects to its OWN database (database-per-service).
export const connectMongo = async (uri) => {
  await mongoose.connect(uri);
  return mongoose.connection;
};

export default connectMongo;
