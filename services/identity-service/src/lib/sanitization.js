import bcrypt from 'bcrypt';
import validator from 'validator';

// Ported verbatim from the monolith (backend/src/utils/sanitization.js).
export const validateSignupData = (data) => {
  const { firstName, email, password, age, gender, photoUrl } = data;

  if (!firstName || firstName.trim().length < 2 || firstName.trim().length > 50)
    throw new Error('First name must be between 2 and 50 characters');

  if (!email || !validator.isEmail(email)) throw new Error('Invalid email address');

  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');

  if (age !== undefined && (age < 18 || age > 75)) throw new Error('Age must be between 18 and 75');

  if (gender !== undefined && !['male', 'female', 'other'].includes(gender))
    throw new Error('Gender must be male, female, or other');

  if (photoUrl !== undefined && photoUrl !== null && !validator.isURL(photoUrl))
    throw new Error('Invalid photo URL');
};

export const sanitizeSignupData = (data) => {
  const allowed = ['firstName', 'lastName', 'email', 'password', 'photoUrl', 'bio', 'skills', 'githubUrl', 'linkedinUrl', 'age', 'gender'];

  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => allowed.includes(key))
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  );
};

export const hashPassword = async (password) => bcrypt.hash(password, 10);
