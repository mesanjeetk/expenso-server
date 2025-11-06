import mongoose from "mongoose";
import bcrypt from "bcryptjs";


const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String },
  avatar: { type: String },
  households: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Household' }],
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: null },
  emailVerificationExpires: { type: Date, default: null }, 
  defaultHousehold: { type: mongoose.Schema.Types.ObjectId, ref: "Household" }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: true
});

// Indexes
UserSchema.index({ households: 1 }); // find users by household quickly (if needed)
UserSchema.index({ defaultHousehold: 1 });
UserSchema.index({ emailVerificationToken: 1 }, { sparse: true }); // quick lookup when verifying email


UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10)
  next()
});


UserSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password)
}


export const User = mongoose.model('User', UserSchema);