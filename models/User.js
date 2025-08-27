const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  signupComplete: {
    type: Boolean,
    default: false
  },
  signupToken: String,
  tokenExpiry: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate signup token
UserSchema.methods.generateSignupToken = async function() {
  // Generate a random token
  const token = Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
  
  // Set token and expiry
  this.signupToken = token;
  this.tokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  await this.save();
  return token;
};

// Method to generate reset token
UserSchema.methods.generateResetToken = async function() {
  // Generate a random token
  const token = Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
  
  // Set token and expiry
  this.resetToken = token;
  this.tokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  await this.save();
  return token;
};

module.exports = mongoose.model('User', UserSchema);
