const mongoose = require('mongoose');

const sosSchema = new mongoose.Schema({
    // The GPS coordinates captured from the browser
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    // The PIN (password) copied from the User model at the time of trigger
    pin: { 
        type: String, 
        required: true 
    },
    // Status flow: pending -> sent OR pending -> cancelled
    status: { 
        type: String, 
        enum: ['pending', 'sent', 'cancelled'], 
        default: 'pending' 
    },
    // Timestamp used by the Police Dashboard to sort the latest alerts
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Create an index to make searching for "sent" alerts faster for the police
sosSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Sos', sosSchema);