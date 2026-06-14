import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import validator from 'validator';
import { config } from '@dc/config';

// identity-service DB (`accounts` collection). System of record for credentials +
// auth state. `_id` is the stable userId shared with profile-service.
const accountSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: false,
      default: null,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => v === null || v === undefined || validator.isEmail(v),
        message: (props) => `${props.value} is not a valid email address`,
      },
    },
    password: { type: String, required: false, minlength: 8, default: null },
    isEmailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, default: null },
    emailVerifyExpiry: { type: Date, default: null },
    passwordResetToken: { type: String, default: null },
    passwordResetExpiry: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    oauthProviders: {
      type: [
        {
          provider: { type: String, enum: ['github', 'google', 'linkedin'], required: true },
          providerId: { type: String, required: true },
          accessToken: { type: String, default: null },
          linkedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'accounts' },
);

accountSchema.pre(/^find/, function () {
  this.where({ isActive: true });
});

accountSchema.methods.validatePassword = async function (inputPassword) {
  return bcrypt.compare(inputPassword, this.password);
};

accountSchema.methods.getJWT = function () {
  return jwt.sign({ id: this._id, tokenVersion: this.tokenVersion }, config.jwtSecret, {
    expiresIn: '1d',
  });
};

export default mongoose.model('Account', accountSchema);
