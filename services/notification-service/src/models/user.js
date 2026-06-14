import mongoose from 'mongoose';

// Minimal read-only projection of the shared `users` collection — only the
// fields this service populates onto a notification's actor. In the shared-DB
// phase (M2) this reads the monolith's users. Once profile-service owns the
// profile read model, replace this populate with an event-fed local copy or an
// API call (see docs/migration §3.1).
const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    photoUrl: String,
  },
  { collection: 'users', strict: false },
);

export default mongoose.model('User', userSchema);
