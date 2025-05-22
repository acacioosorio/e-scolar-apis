// Notification Controller
// /api/notifications/notification.controller.js

const mongoose = require('mongoose');
const Notification = mongoose.model('Notification');
const AcademicProgress = mongoose.model('AcademicProgress');
const Student = mongoose.model('Student');
const Classes = mongoose.model('Classes');
const Subject = mongoose.model('Subjects');
const User = mongoose.model('Users');

/**
 * Controller para gerenciamento de notificações
 * 
 * Este controller fornece endpoints para gerenciar notificações,
 * incluindo criação, listagem, marcação como lida e exclusão.
 */

/**
 * Cria uma nova notificação
 */
exports.createNotification = async (req, res) => {
	try {
		const notification = await Notification.create(req.body);

		return res.status(201).json({
			success: true,
			data: notification
		});
	} catch (error) {
		console.error('Error creating notification:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Erro ao criar notificação'
		});
	}
};

/**
 * Obtém todas as notificações do usuário atual
 */
exports.getMyNotifications = async (req, res) => {
	try {
		const { read, type, limit = 20, page = 1 } = req.query;

		// Construir filtro
		const filter = {
			recipient: req.user._id,
			status: 'active'
		};

		// Filtrar por status de leitura se especificado
		if (read !== undefined) {
			filter.read = read === 'true';
		}

		// Filtrar por tipo se especificado
		if (type) {
			filter.type = type;
		}

		// Calcular paginação
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Buscar notificações
		const notifications = await Notification.find(filter)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(parseInt(limit))
			.populate('references.student', 'name admissionNumber')
			.populate('references.class', 'name')
			.populate('references.subject', 'name');

		// Contar total para paginação
		const total = await Notification.countDocuments(filter);

		return res.status(200).json({
			success: true,
			count: notifications.length,
			total,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
				totalPages: Math.ceil(total / parseInt(limit))
			},
			data: notifications
		});
	} catch (error) {
		console.error('Error fetching notifications:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Erro ao buscar notificações'
		});
	}
};

/**
 * Marca uma notificação como lida
 */
exports.markAsRead = async (req, res) => {
	try {
		const notification = await Notification.findById(req.params.id);

		if (!notification) {
			return res.status(404).json({
				success: false,
				message: 'Notificação não encontrada'
			});
		}

		// Verificar se o usuário é o destinatário
		if (notification.recipient.toString() !== req.user._id.toString()) {
			return res.status(403).json({
				success: false,
				message: 'Você não tem permissão para acessar esta notificação'
			});
		}

		// Marcar como lida
		notification.read = true;
		notification.readAt = new Date();
		await notification.save();

		return res.status(200).json({
			success: true,
			data: notification
		});
	} catch (error) {
		console.error('Error marking notification as read:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Erro ao marcar notificação como lida'
		});
	}
};

/**
 * Marca todas as notificações do usuário como lidas
 */
exports.markAllAsRead = async (req, res) => {
	try {
		const { type } = req.query;

		// Construir filtro
		const filter = {
			recipient: req.user._id,
			read: false,
			status: 'active'
		};

		// Filtrar por tipo se especificado
		if (type) {
			filter.type = type;
		}

		// Atualizar todas as notificações não lidas
		const result = await Notification.updateMany(
			filter,
			{
				$set: {
					read: true,
					readAt: new Date()
				}
			}
		);

		return res.status(200).json({
			success: true,
			count: result.nModified,
			message: `${result.nModified} notificações marcadas como lidas`
		});
	} catch (error) {
		console.error('Error marking all notifications as read:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Erro ao marcar notificações como lidas'
		});
	}
};

/**
 * Arquiva uma notificação
 */
exports.archiveNotification = async (req, res) => {
	try {
		const notification = await Notification.findById(req.params.id);

		if (!notification) {
			return res.status(404).json({
				success: false,
				message: 'Notificação não encontrada'
			});
		}

		// Verificar se o usuário é o destinatário
		if (notification.recipient.toString() !== req.user._id.toString()) {
			return res.status(403).json({
				success: false,
				message: 'Você não tem permissão para acessar esta notificação'
			});
		}

		// Arquivar notificação
		notification.status = 'archived';
		await notification.save();

		return res.status(200).json({
			success: true,
			data: notification
		});
	} catch (error) {
		console.error('Error archiving notification:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Erro ao arquivar notificação'
		});
	}
};

/**
 * Gera notificações para alunos em risco de reprovação
 * Esta função é chamada por um job agendado ou manualmente por administradores
 */
exports.generateRiskNotifications = async (req, res) => {
	try {
		const { academicYearId } = req.params;
		const schoolId = req.user.school;

		// Verificar permissões (apenas administradores podem gerar notificações em massa)
		if (req.user.role !== 'admin') {
			return res.status(403).json({
				success: false,
				message: 'Você não tem permissão para gerar notificações em massa'
			});
		}

		// Buscar alunos em risco
		const progressRecords = await AcademicProgress.find({
			school: schoolId,
			academicYear: academicYearId,
			overallStatus: { $ne: 'approved' } // Não aprovados
		})
			.populate('student', 'name admissionNumber')
			.populate('class', 'name')
			.populate('subjectResults.subject', 'name')
			.populate('yearLevel', 'name');

		// Contador de notificações criadas
		let notificationsCreated = 0;

		// Para cada aluno em risco
		for (const progress of progressRecords) {
			// Identificar disciplinas com problema
			const failedSubjects = progress.subjectResults.filter(sr => !sr.passed);

			if (failedSubjects.length > 0) {
				// Buscar professores da turma
				const classTeachers = await Classes.findById(progress.class._id)
					.select('teachers')
					.populate('teachers', 'name email');

				// Buscar pais/responsáveis do aluno
				const student = await Student.findById(progress.student._id)
					.select('parents')
					.populate('parents', 'name email');

				// Lista de disciplinas com problema
				const subjectsList = failedSubjects.map(sr => sr.subject.name).join(', ');

				// Criar notificação para cada professor
				if (classTeachers && classTeachers.teachers) {
					for (const teacher of classTeachers.teachers) {
						await Notification.create({
							school: schoolId,
							recipient: teacher._id,
							type: 'academic_risk',
							title: 'Aluno em risco de reprovação',
							message: `O aluno ${progress.student.name} está com desempenho abaixo do esperado nas seguintes disciplinas: ${subjectsList}`,
							priority: 'high',
							references: {
								student: progress.student._id,
								class: progress.class._id,
								academicYear: academicYearId
							},
							data: {
								failedSubjects: failedSubjects.map(sr => ({
									subject: sr.subject._id,
									name: sr.subject.name,
									average: sr.finalAverage,
									requiredGrade: sr.requiredGrade
								})),
								yearLevel: progress.yearLevel.name
							}
						});

						notificationsCreated++;
					}
				}

				// Criar notificação para cada pai/responsável
				if (student && student.parents) {
					for (const parent of student.parents) {
						await Notification.create({
							school: schoolId,
							recipient: parent._id,
							type: 'academic_risk',
							title: 'Alerta de desempenho acadêmico',
							message: `Seu filho(a) ${progress.student.name} está com desempenho abaixo do esperado nas seguintes disciplinas: ${subjectsList}`,
							priority: 'high',
							references: {
								student: progress.student._id,
								class: progress.class._id,
								academicYear: academicYearId
							},
							data: {
								failedSubjects: failedSubjects.map(sr => ({
									subject: sr.subject._id,
									name: sr.subject.name,
									average: sr.finalAverage,
									requiredGrade: sr.requiredGrade
								})),
								yearLevel: progress.yearLevel.name
							}
						});

						notificationsCreated++;
					}
				}
			}
		}

		return res.status(200).json({
			success: true,
			count: notificationsCreated,
			message: `${notificationsCreated} notificações geradas com sucesso`
		});
	} catch (error) {
		console.error('Error generating risk notifications:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Erro ao gerar notificações de risco'
		});
	}
};

/**
 * Obtém contagem de notificações não lidas do usuário atual
 */
exports.getUnreadCount = async (req, res) => {
	try {
		const count = await Notification.countDocuments({
			recipient: req.user._id,
			read: false,
			status: 'active'
		});

		return res.status(200).json({
			success: true,
			count
		});
	} catch (error) {
		console.error('Error counting unread notifications:', error);
		return res.status(500).json({
			success: false,
			message: error.message || 'Erro ao contar notificações não lidas'
		});
	}
};