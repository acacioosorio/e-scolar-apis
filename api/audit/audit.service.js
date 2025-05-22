// Audit Service
// ./api/audit/audit.service.js

const AuditLog = require('./auditLog.model');
const { createAuditLog } = require('../../middleware/audit.middleware');

class AuditService {
	// Registrar login de usuário
	static async logLogin(user, ipAddress, userAgent) {
		return createAuditLog(
			user,
			user.school,
			'login',
			'Users',
			user._id,
			`${user.name} realizou login no sistema`,
			{
				ipAddress,
				userAgent,
				metadata: { timestamp: new Date() }
			}
		);
	}

	// Registrar logout de usuário
	static async logLogout(user, ipAddress, userAgent) {
		return createAuditLog(
			user,
			user.school,
			'logout',
			'Users',
			user._id,
			`${user.name} realizou logout do sistema`,
			{
				ipAddress,
				userAgent,
				metadata: { timestamp: new Date() }
			}
		);
	}

	// Registrar alteração de notas
	static async logGradeChange(user, mark, oldGrade, newGrade, ipAddress, userAgent) {
		return createAuditLog(
			user,
			mark.school,
			'update',
			'Marks',
			mark._id,
			`${user.name} alterou a nota do aluno ${mark.student.name || mark.student} na disciplina ${mark.subject.name || mark.subject}`,
			{
				entityInfo: {
					name: 'Nota',
					identifier: mark._id.toString(),
					type: newGrade.toString()
				},
				changedFields: [{
					field: 'grade',
					oldValue: oldGrade,
					newValue: newGrade
				}],
				previousState: { ...mark, grade: oldGrade },
				newState: { ...mark, grade: newGrade },
				ipAddress,
				userAgent,
				metadata: {
					studentId: mark.student,
					subjectId: mark.subject,
					classId: mark.class
				}
			}
		);
	}

	// Registrar alteração de status de matrícula
	static async logEnrollmentStatusChange(user, enrollment, oldStatus, newStatus, ipAddress, userAgent) {
		return createAuditLog(
			user,
			enrollment.school,
			'update',
			'Enrollment',
			enrollment._id,
			`${user.name} alterou o status da matrícula do aluno ${enrollment.student.name || enrollment.student} de ${oldStatus} para ${newStatus}`,
			{
				entityInfo: {
					name: 'Matrícula',
					identifier: enrollment._id.toString(),
					type: newStatus
				},
				changedFields: [{
					field: 'status',
					oldValue: oldStatus,
					newValue: newStatus
				}],
				previousState: { ...enrollment, status: oldStatus },
				newState: { ...enrollment, status: newStatus },
				ipAddress,
				userAgent,
				metadata: {
					studentId: enrollment.student,
					classId: enrollment.class
				}
			}
		);
	}

	// Buscar logs de auditoria com filtros
	static async getLogs(filters = {}, pagination = { page: 1, limit: 20 }) {
		const query = {};

		if (filters.school) query.school = filters.school;
		if (filters.user) query.user = filters.user;
		if (filters.entityType) query.entityType = filters.entityType;
		if (filters.entityId) query.entityId = filters.entityId;
		if (filters.action) query.action = filters.action;
		if (filters.startDate && filters.endDate) {
			query.createdAt = {
				$gte: new Date(filters.startDate),
				$lte: new Date(filters.endDate)
			};
		}
		if (filters.search) {
			query.$or = [
				{ 'entityInfo.name': { $regex: filters.search, $options: 'i' } },
				{ 'entityInfo.identifier': { $regex: filters.search, $options: 'i' } },
				{ description: { $regex: filters.search, $options: 'i' } }
			];
		}

		const options = {
			sort: { createdAt: -1 },
			skip: (pagination.page - 1) * pagination.limit,
			limit: pagination.limit
		};

		const [logs, total] = await Promise.all([
			AuditLog.find(query, null, options)
				.populate('user', 'name email role')
				.populate('school', 'name'),
			AuditLog.countDocuments(query)
		]);

		return {
			logs,
			pagination: {
				total,
				page: pagination.page,
				limit: pagination.limit,
				pages: Math.ceil(total / pagination.limit)
			}
		};
	}
}

module.exports = AuditService;
