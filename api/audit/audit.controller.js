// Audit Controller
// ./api/audit/audit.controller.js

const express = require('express');
const router = express.Router();
const AuditService = require('./audit.service');
const AuditLog = require('./auditLog.model');
const auth = require('../../middleware/auth');
const { checkRole } = require('../../middleware/role');

// Middleware para verificar se o usuário é administrador
const isAdmin = checkRole(['admin', 'backoffice']);

// Obter logs de auditoria (apenas para administradores)
router.get('/', auth, isAdmin, async (req, res) => {
	try {
		const filters = {
			school: req.query.school,
			user: req.query.user,
			entityType: req.query.entityType,
			entityId: req.query.entityId,
			action: req.query.action,
			startDate: req.query.startDate,
			endDate: req.query.endDate,
			search: req.query.search
		};

		const pagination = {
			page: parseInt(req.query.page) || 1,
			limit: parseInt(req.query.limit) || 20
		};

		// Garantir que usuários só vejam logs da própria escola
		if (req.user.role !== 'admin') {
			filters.school = req.user.school;
		}

		const result = await AuditService.getLogs(filters, pagination);

		res.json(result);
	} catch (error) {
		console.error('Error fetching audit logs:', error);
		res.status(500).json({ message: 'Erro ao buscar logs de auditoria', error: error.message });
	}
});

// Obter detalhes de um log específico
router.get('/:id', auth, isAdmin, async (req, res) => {
	try {
		const log = await AuditLog.findById(req.params.id)
			.populate('user', 'name email role')
			.populate('school', 'name');

		if (!log) {
			return res.status(404).json({ message: 'Log de auditoria não encontrado' });
		}

		// Garantir que usuários só vejam logs da própria escola
		if (req.user.role !== 'admin' && log.school._id.toString() !== req.user.school.toString()) {
			return res.status(403).json({ message: 'Não autorizado' });
		}

		res.json(log);
	} catch (error) {
		console.error('Error fetching audit log details:', error);
		res.status(500).json({ message: 'Erro ao buscar detalhes do log de auditoria', error: error.message });
	}
});

module.exports = router;