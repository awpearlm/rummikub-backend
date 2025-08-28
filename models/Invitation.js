const mongoose = require('mongoose');

const InvitationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'cancelled'],
    default: 'pending'
  },
  invitationToken: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: {
    type: Date
  },
  message: {
    type: String,
    maxlength: 500
  }
});

// Index for automatic cleanup of expired invitations
InvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to generate invitation token
InvitationSchema.statics.generateInvitationToken = function() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) +
         Date.now().toString(36);
};

module.exports = mongoose.model('Invitation', InvitationSchema);
