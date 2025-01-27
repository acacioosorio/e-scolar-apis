const Webhook = require('./webhook.model');
const WebhookService = require('./webhook.service');
const { logger } = require('../../helpers');

exports.createWebhook = async (req, res) => {
    try {
        const { url, events } = req.body;
        const schoolId = req.user.school;

        const webhook = new Webhook({
            url,
            events,
            school: schoolId,
            secret: WebhookService.generateSecret()
        });

        await webhook.save();

        res.status(201).json({
            success: true,
            webhook: {
                id: webhook._id,
                url: webhook.url,
                events: webhook.events,
                secret: webhook.secret
            }
        });
    } catch (error) {
        logger.error('Create webhook error:', error);
        res.status(500).json({ error: 'Error creating webhook' });
    }
};

exports.listWebhooks = async (req, res) => {
    try {
        const schoolId = req.user.school;
        const webhooks = await Webhook.find({ school: schoolId });

        res.json({ webhooks });
    } catch (error) {
        logger.error('List webhooks error:', error);
        res.status(500).json({ error: 'Error listing webhooks' });
    }
};

exports.deleteWebhook = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.school;

        const webhook = await Webhook.findOneAndDelete({
            _id: id,
            school: schoolId
        });

        if (!webhook) {
            return res.status(404).json({ error: 'Webhook not found' });
        }

        res.json({ message: 'Webhook deleted successfully' });
    } catch (error) {
        logger.error('Delete webhook error:', error);
        res.status(500).json({ error: 'Error deleting webhook' });
    }
};