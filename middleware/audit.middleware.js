// Audit Middleware
// ./middleware/audit.middleware.js

const AuditLog = require('../api/audit/auditLog.model');
const mongoose = require('mongoose');

// Função auxiliar para extrair informações relevantes da entidade
const extractEntityInfo = (entityType, entity) => {

	console.log("extractEntityInfo entityType", entityType);
	console.log("extractEntityInfo entity", entity);

	const info = { name: '', identifier: '', type: '' };

	switch (entityType) {
		case 'Student':
			info.name = entity.name || '';
			info.identifier = entity.admissionNumber || '';
			break;
		case 'Classes':
			info.name = entity.name || '';
			info.identifier = entity._id.toString();
			info.type = entity.shift || '';
			break;
		case 'Marks':
			info.name = 'Grade';
			info.identifier = entity._id.toString();
			info.type = entity.grade ? entity.grade.toString() : '';
			break;
		case 'Enrollment':
			info.name = 'Enrollment';
			info.identifier = entity._id.toString();
			info.type = entity.status || '';
			break;
		case 'Users':
			info.name = entity.name || '';
			info.identifier = entity.email || '';
			info.type = entity.role || '';
			break;
		case 'School':
			info.name = entity.name || '';
			info.identifier = entity._id.toString();
			break;
		// Adicionar casos para outras entidades
		default:
			info.name = entity.name || entity.title || '';
			info.identifier = entity._id.toString();
	}

	return info;
};

// Middleware para registrar ações de criação
const auditCreate = (entityType, Model) => async (req, res, next) => {
	const originalSend = res.send;

	res.send = function (data) {
		const responseBody = JSON.parse(data);

		if (res.statusCode >= 200 && res.statusCode < 300 && responseBody) {
			try {
				const entity = responseBody.data || responseBody;
				const user = req.user;

				console.log("auditCreate entity", entity);

				const auditLog = new AuditLog({
					user: user._id,
					userInfo: {
						name: `${user.firstName} ${user.lastName}`,
						email: user.email,
						role: user.role
					},
					school: req.body.school || entity.school,
					action: 'create',
					entityType,
					entityId: entity._id,
					entityInfo: extractEntityInfo(entityType, entity),
					description: `${user.firstName} ${user.lastName} criou um novo ${entityType}: ${entity.name || entity._id}`,
					newState: entity,
					ipAddress: req.ip,
					userAgent: req.headers['user-agent']
				});

				auditLog.save().catch(err => console.error('Error saving audit log:', err));
			} catch (err) {
				console.error('Error in audit middleware:', err);
			}
		}

		originalSend.call(this, data);
	};

	next();
};

// Middleware para registrar ações de atualização
const auditUpdate = (entityType, Model) => async (req, res, next) => {
	try {
		// Buscar estado anterior da entidade
		const entityId = req.params.id;
		const previousState = await Model.findById(entityId).lean();

		if (!previousState) {
			return next();
		}

		const originalSend = res.send;

		res.send = function (data) {
			const responseBody = JSON.parse(data);

			if (res.statusCode >= 200 && res.statusCode < 300 && responseBody) {
				try {
					const entity = responseBody.data || responseBody;
					const user = req.user;

					// Identificar campos alterados
					const changedFields = [];
					Object.keys(req.body).forEach(key => {
						if (JSON.stringify(previousState[key]) !== JSON.stringify(req.body[key])) {
							changedFields.push({
								field: key,
								oldValue: previousState[key],
								newValue: req.body[key]
							});
						}
					});

					const auditLog = new AuditLog({
						user: user._id,
						userInfo: {
							name: `${user.firstName} ${user.lastName}`,
							id: user._id,
							email: user.email,
							role: user.role
						},
						school: previousState.school,
						action: 'update',
						entityType,
						entityId: previousState._id,
						entityInfo: extractEntityInfo(entityType, previousState),
						description: `${user.firstName} ${user.lastName} atualizou ${entityType}: ${previousState.name || previousState._id}`,
						changedFields,
						previousState,
						newState: entity,
						ipAddress: req.ip,
						userAgent: req.headers['user-agent']
					});

					auditLog.save().catch(err => console.error('Error saving audit log:', err));
				} catch (err) {
					console.error('Error in audit middleware:', err);
				}
			}

			originalSend.call(this, data);
		};
	} catch (err) {
		console.error('Error in audit middleware setup:', err);
	}

	next();
};

// Middleware para registrar ações de exclusão/arquivamento
const auditDelete = (entityType, Model) => async (req, res, next) => {
	try {
		// Buscar estado anterior da entidade
		const entityId = req.params.id;
		const previousState = await Model.findById(entityId).lean();

		if (!previousState) {
			return next();
		}

		const originalSend = res.send;

		res.send = function (data) {
			if (res.statusCode >= 200 && res.statusCode < 300) {
				try {
					const user = req.user;
					const isArchive = req.body && req.body.status === 'archived';

					const auditLog = new AuditLog({
						user: user._id,
						userInfo: {
							name: `${user.firstName} ${user.lastName}`,
							email: user.email,
							role: user.role
						},
						school: previousState.school,
						action: isArchive ? 'archive' : 'delete',
						entityType,
						entityId: previousState._id,
						entityInfo: extractEntityInfo(entityType, previousState),
						description: `${user.firstName} ${user.lastName} ${isArchive ? 'arquivou' : 'excluiu'} ${entityType}: ${previousState.name || previousState._id}`,
						previousState,
						ipAddress: req.ip,
						userAgent: req.headers['user-agent']
					});

					auditLog.save().catch(err => console.error('Error saving audit log:', err));
				} catch (err) {
					console.error('Error in audit middleware:', err);
				}
			}

			originalSend.call(this, data);
		};
	} catch (err) {
		console.error('Error in audit middleware setup:', err);
	}

	next();
};

// Função para registrar auditoria manualmente
const createAuditLog = async (user, school, action, entityType, entityId, description, details = {}) => {
	try {
		const auditLog = new AuditLog({
			user: user._id,
			userInfo: {
				name: user.name,
				email: user.email,
				role: user.role
			},
			school,
			action,
			entityType,
			entityId,
			entityInfo: details.entityInfo || {},
			description,
			changedFields: details.changedFields || [],
			previousState: details.previousState || null,
			newState: details.newState || null,
			ipAddress: details.ipAddress || '',
			userAgent: details.userAgent || '',
			metadata: details.metadata || {}
		});

		return await auditLog.save();
	} catch (err) {
		console.error('Error creating audit log:', err);
		return null;
	}
};

module.exports = {
	auditCreate,
	auditUpdate,
	auditDelete,
	createAuditLog
};