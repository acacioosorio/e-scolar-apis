// AuditLog Model
// ./api/audit/auditLog.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AuditLogSchema = new Schema({
	// Quem realizou a ação
	user: {
		type: Schema.Types.ObjectId,
		ref: 'Users',
		required: true
	},
	// Informações do usuário no momento da ação (para referência mesmo se o usuário for alterado depois)
	userInfo: {
		name: String,
		email: String,
		role: String
	},
	// Escola relacionada à ação
	school: {
		type: Schema.Types.ObjectId,
		ref: 'School',
		required: true
	},
	// Tipo de operação realizada
	action: {
		type: String,
		enum: ['create', 'update', 'delete', 'archive', 'restore', 'login', 'logout', 'other'],
		required: true
	},
	// Entidade afetada (nome do modelo)
	entityType: {
		type: String,
		required: true
	},
	// ID do documento afetado
	entityId: {
		type: Schema.Types.ObjectId,
		required: true
	},
	// Informações adicionais sobre a entidade (para facilitar buscas sem joins)
	entityInfo: {
		name: {
			type: String,
		},
		identifier: {
			type: String,
		},
		type: {
			type: String,
		}
		// required: true
	},
	// Descrição da ação em linguagem natural
	description: {
		type: String,
		required: true
	},
	// Campos que foram alterados (para ações de update)
	changedFields: [{
		field: String,
		oldValue: Schema.Types.Mixed,
		newValue: Schema.Types.Mixed
	}],
	// Dados completos antes da alteração (para referência)
	previousState: Schema.Types.Mixed,
	// Dados completos após a alteração (para referência)
	newState: Schema.Types.Mixed,
	// IP do usuário
	ipAddress: String,
	// Informações do navegador/dispositivo
	userAgent: String,
	// Metadados adicionais específicos da ação
	metadata: Schema.Types.Mixed
}, {
	timestamps: true,
	// Configurar para não permitir alterações nos logs de auditoria
	capped: {
		size: 5242880, // 5MB - ajustar conforme necessidade
		max: 10000     // Máximo de documentos - ajustar conforme necessidade
	}
});

// Índices para otimizar consultas comuns
AuditLogSchema.index({ school: 1, createdAt: -1 });
AuditLogSchema.index({ user: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ 'entityInfo.name': 'text', 'entityInfo.identifier': 'text', description: 'text' });

module.exports = mongoose.model('AuditLog', AuditLogSchema);