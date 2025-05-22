// Notification Model
// /api/notifications/notification.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = global.Promise;

/**
 * Modelo de Notification (Notificação)
 * 
 * Este modelo armazena notificações do sistema para usuários,
 * incluindo alertas sobre alunos em risco de reprovação.
 */
const NotificationSchema = new Schema(
	{
		// Escola relacionada
		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: [true, "School is required"],
		},

		// Usuário destinatário da notificação
		recipient: {
			type: Schema.Types.ObjectId,
			ref: "Users",
			required: [true, "Recipient is required"],
		},

		// Tipo de notificação
		type: {
			type: String,
			enum: ['academic_risk', 'grade_update', 'attendance_alert', 'system', 'other'],
			required: [true, "Notification type is required"],
		},

		// Título da notificação
		title: {
			type: String,
			required: [true, "Title is required"],
		},

		// Conteúdo da notificação
		message: {
			type: String,
			required: [true, "Message is required"],
		},

		// Dados adicionais relacionados à notificação (formato livre)
		data: {
			type: Schema.Types.Mixed,
		},

		// Referências a entidades relacionadas
		references: {
			student: {
				type: Schema.Types.ObjectId,
				ref: "Student",
			},
			class: {
				type: Schema.Types.ObjectId,
				ref: "Classes",
			},
			subject: {
				type: Schema.Types.ObjectId,
				ref: "Subjects",
			},
			academicYear: {
				type: Schema.Types.ObjectId,
				ref: "AcademicYear",
			},
		},

		// Status de leitura
		read: {
			type: Boolean,
			default: false,
		},

		// Data de leitura
		readAt: {
			type: Date,
		},

		// Prioridade da notificação
		priority: {
			type: String,
			enum: ['low', 'medium', 'high', 'urgent'],
			default: 'medium',
		},

		// Status da notificação
		status: {
			type: String,
			enum: ['active', 'archived', 'deleted'],
			default: 'active',
		},
	},
	{ timestamps: true }
);

// Índices para otimizar consultas comuns
NotificationSchema.index({ recipient: 1, read: 1 });
NotificationSchema.index({ school: 1, type: 1 });
NotificationSchema.index({ 'references.student': 1 });
NotificationSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
