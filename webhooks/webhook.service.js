const crypto = require('crypto');
const axios = require('axios');
const Webhook = require('./webhook.model');
const { logger } = require('../helpers');

class WebhookService {
    static generateSecret() {
        return crypto.randomBytes(32).toString('hex');
    }

    static generateSignature(payload, secret) {
        return crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
    }

    static async sendWebhook(webhook, event, payload) {
        const signature = this.generateSignature(payload, webhook.secret);

        try {
            await axios.post(webhook.url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': signature,
                    'X-Webhook-Event': event
                },
                timeout: 5000
            });

            await Webhook.findByIdAndUpdate(webhook._id, {
                lastDeliveryAttempt: new Date(),
                lastDeliverySuccess: true
            });

            logger.info(`Webhook delivered successfully to ${webhook.url}`);
        } catch (error) {
            await Webhook.findByIdAndUpdate(webhook._id, {
                lastDeliveryAttempt: new Date(),
                lastDeliverySuccess: false
            });

            logger.error(`Webhook delivery failed for ${webhook.url}: ${error.message}`);
            throw error;
        }
    }

    static async dispatchEvent(schoolId, event, payload) {
        try {
            const webhooks = await Webhook.find({
                school: schoolId,
                active: true,
                events: event
            });

            const deliveryPromises = webhooks.map(webhook =>
                this.sendWebhook(webhook, event, payload)
            );

            await Promise.allSettled(deliveryPromises);
        } catch (error) {
            logger.error(`Error dispatching webhooks: ${error.message}`);
        }
    }
}

module.exports = WebhookService;