const mongoose = require('mongoose');

const WebhookSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^https?:\/\/.+/.test(v);
            },
            message: 'URL must be valid and start with http:// or https://'
        }
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true
    },
    events: [{
        type: String,
        enum: ['student.created', 'student.updated', 'student.deleted',
            'user.created', 'user.updated', 'user.deleted',
            'school.updated', 'school.status_changed']
    }],
    active: {
        type: Boolean,
        default: true
    },
    secret: {
        type: String,
        required: true
    },
    lastDeliveryAttempt: Date,
    lastDeliverySuccess: Boolean,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Webhook', WebhookSchema);