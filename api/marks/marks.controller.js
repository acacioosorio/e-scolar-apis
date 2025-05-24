// Marks Controller
// ./api/marks/marks.controller.js

const Marks = require('./marks.model');
const Subjects = require('../subjects/subjects.model');
const Classes = require('../classes/classes.model');
const Student = require('../students/students.model');
const Enrollment = require('../enrollment/enrollment.model');
const { createErrorResponse } = require('../../helpers');

/**
 * Lista notas com filtros, busca e paginação
 */
exports.listMarks = async (req, res, next) => {
	try {
		const schoolId = req.query.schoolId || req.user?.school;

		const {
			page = parseInt(req.query.page) || 1,
			limit = parseInt(req.query.limit) || 10,
			sortBy = 'date',
			order = req.query.order === 'desc' ? -1 : 1
		} = req.query;

		const skip = (page - 1) * limit;

		if (!schoolId) {
			return res.status(400).json(createErrorResponse('School ID is required'));
		}

		const filter = { school: schoolId };

		// Filtros diretos
		if (req.query.student) filter.student = req.query.student;
		if (req.query.subject) filter.subject = req.query.subject;
		if (req.query.class) filter.class = req.query.class;
		if (req.query.evaluationPeriod) filter.evaluationPeriod = req.query.evaluationPeriod;
		if (req.query.evaluationType) filter.evaluationType = req.query.evaluationType;
		if (req.query.status) filter.status = req.query.status;
		if (req.query.isRecovery) filter.isRecovery = req.query.isRecovery === 'true';

		// Filtro por academicYear (indireto via class)
		if (req.query.academicYear) {
			const classes = await Classes.find({
				academicYear: req.query.academicYear,
				school: schoolId
			});

			if (classes.length > 0) {
				filter.class = { $in: classes.map(c => c._id) };
			} else {
				// Se não encontrar classes com o filtro, retornar vazio
				return res.status(200).json({
					success: true,
					data: {
						marks: [],
						pagination: {
							currentPage: page,
							totalPages: 0,
							totalItems: 0,
							itemsPerPage: limit,
							hasNextPage: false,
							hasPreviousPage: false
						}
					}
				});
			}
		}

		// Busca por título
		if (req.query.search) {
			const searchRegex = new RegExp(req.query.search, 'i');
			filter.title = searchRegex;
		}

		// Filtro por intervalo de datas
		if (req.query.startDate) {
			filter.date = { ...filter.date, $gte: new Date(req.query.startDate) };
		}
		if (req.query.endDate) {
			filter.date = { ...filter.date, $lte: new Date(req.query.endDate) };
		}

		const [totalCount, marks] = await Promise.all([
			Marks.countDocuments(filter),
			Marks.find(filter)
				.populate('student', 'firstName lastName registrationNumber')
				.populate('subject', 'name code')
				.populate({
					path: 'class',
					select: 'name yearLevel academicYear',
					populate: [
						{ path: 'yearLevel', select: 'name order' },
						{ path: 'academicYear', select: 'name startDate endDate' }
					]
				})
				.populate('registeredBy', 'firstName lastName')
				.sort({ [sortBy]: order })
				.skip(skip)
				.limit(limit)
		]);

		const totalPages = Math.ceil(totalCount / limit);

		res.status(200).json({
			success: true,
			data: {
				marks,
				pagination: {
					currentPage: page,
					totalPages,
					totalItems: totalCount,
					itemsPerPage: limit,
					hasNextPage: page < totalPages,
					hasPreviousPage: page > 1
				}
			}
		});
	} catch (err) { next(err); }
};

/**
 * Obtém detalhes de uma nota específica
 */
exports.getMark = async (req, res, next) => {
	try {
		const mark = await Marks.findOne({
			_id: req.params.id,
			school: req.user.school
		})
			.populate('student', 'firstName lastName registrationNumber')
			.populate('subject', 'name code')
			.populate({
				path: 'class',
				select: 'name yearLevel academicYear',
				populate: [
					{ path: 'yearLevel', select: 'name order' },
					{ path: 'academicYear', select: 'name startDate endDate' }
				]
			})
			.populate('registeredBy', 'firstName lastName');

		if (!mark) return res.status(404).json(createErrorResponse('Mark not found'));

		res.json({ success: true, data: mark });
	} catch (err) { next(err); }
};

/**
 * Cria uma nova nota
 */
exports.createMark = async (req, res, next) => {
	try {
		const {
			student, subject, class: classId, evaluationPeriod,
			evaluationType, title, grade, weight, date, comments,
			status, isRecovery, metadata
		} = req.body;

		// Validações básicas
		if (!student || !subject || !classId || !evaluationPeriod || !evaluationType || !title || grade === undefined) {
			return res.status(400).json(createErrorResponse('Missing required fields'));
		}

		// Verificar se a classe existe
		const classObj = await Classes.findOne({
			_id: classId,
			school: req.user.school
		});

		if (!classObj) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		// Verificar se o aluno está matriculado nesta classe
		const enrollment = await Enrollment.findOne({
			student,
			class: classId
		});

		if (!enrollment) {
			return res.status(400).json(createErrorResponse('Student is not enrolled in this class'));
		}

		// Verificar se a disciplina está associada a esta classe
		const subjectObj = await Subjects.findOne({
			_id: subject,
			classes: classId
		});

		if (!subjectObj) {
			return res.status(400).json(createErrorResponse('Subject is not associated with this class'));
		}

		// Criar a nota
		const mark = await Marks.create({
			school: req.user.school,
			student,
			subject,
			class: classId,
			evaluationPeriod,
			evaluationType,
			title,
			grade,
			weight: weight || 1,
			date: date || new Date(),
			registeredBy: req.user._id,
			comments,
			status: status || 'published',
			isRecovery: isRecovery || false,
			metadata
		});

		// Retornar com dados populados
		const populatedMark = await Marks.findById(mark._id)
			.populate('student', 'firstName lastName registrationNumber')
			.populate('subject', 'name code')
			.populate({
				path: 'class',
				select: 'name yearLevel academicYear',
				populate: [
					{ path: 'yearLevel', select: 'name' },
					{ path: 'academicYear', select: 'name' }
				]
			})
			.populate('registeredBy', 'firstName lastName');

		res.status(201).json({
			success: true,
			data: populatedMark
		});
	} catch (err) { next(err); }
};

/**
 * Atualiza uma nota existente
 */
exports.updateMark = async (req, res, next) => {
	try {
		const { id } = req.params;
		const {
			evaluationPeriod, evaluationType, title, grade, weight,
			date, comments, status, isRecovery, metadata
		} = req.body;

		// Verificar se a nota existe
		const mark = await Marks.findOne({
			_id: id,
			school: req.user.school
		});

		if (!mark) {
			return res.status(404).json(createErrorResponse('Mark not found'));
		}

		// Validar status
		if (status && !['draft', 'published', 'revised', 'final'].includes(status)) {
			return res.status(400).json(createErrorResponse(
				'Invalid status. Must be one of: draft, published, revised, final'
			));
		}

		// Atualizar campos permitidos
		const updates = {};
		if (evaluationPeriod !== undefined) updates.evaluationPeriod = evaluationPeriod;
		if (evaluationType !== undefined) updates.evaluationType = evaluationType;
		if (title !== undefined) updates.title = title;
		if (grade !== undefined) updates.grade = grade;
		if (weight !== undefined) updates.weight = weight;
		if (date !== undefined) updates.date = date;
		if (comments !== undefined) updates.comments = comments;
		if (status !== undefined) updates.status = status;
		if (isRecovery !== undefined) updates.isRecovery = isRecovery;
		if (metadata !== undefined) updates.metadata = metadata;

		// Atualizar a nota
		const updatedMark = await Marks.findByIdAndUpdate(
			id,
			{ $set: updates },
			{ new: true }
		)
			.populate('student', 'firstName lastName registrationNumber')
			.populate('subject', 'name code')
			.populate({
				path: 'class',
				select: 'name yearLevel academicYear',
				populate: [
					{ path: 'yearLevel', select: 'name' },
					{ path: 'academicYear', select: 'name' }
				]
			})
			.populate('registeredBy', 'firstName lastName');

		res.json({
			success: true,
			data: updatedMark,
			message: 'Mark updated successfully'
		});
	} catch (err) { next(err); }
};

/**
 * Exclui uma nota
 */
exports.deleteMark = async (req, res, next) => {
	try {
		const { id } = req.params;

		// Verificar se a nota existe
		const mark = await Marks.findOne({
			_id: id,
			school: req.user.school
		});

		if (!mark) {
			return res.status(404).json(createErrorResponse('Mark not found'));
		}

		// Verificar se a nota está em status final
		if (mark.status === 'final') {
			return res.status(400).json(createErrorResponse(
				'Cannot delete a mark with final status'
			));
		}

		// Excluir a nota
		await Marks.findByIdAndDelete(id);

		res.json({
			success: true,
			message: 'Mark deleted successfully'
		});
	} catch (err) { next(err); }
};

/**
 * Gera o boletim de um aluno
 */
exports.generateStudentReport = async (req, res, next) => {
	try {
		const { studentId, classId } = req.params;

		// Verificar se o aluno e a classe existem
		const [student, classObj] = await Promise.all([
			Student.findOne({ _id: studentId, school: req.user.school }),
			Classes.findOne({ _id: classId, school: req.user.school })
		]);

		if (!student) {
			return res.status(404).json(createErrorResponse('Student not found'));
		}

		if (!classObj) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		// Verificar se o aluno está matriculado nesta classe
		const enrollment = await Enrollment.findOne({
			student: studentId,
			class: classId
		});

		if (!enrollment) {
			return res.status(400).json(createErrorResponse('Student is not enrolled in this class'));
		}

		// Gerar o boletim usando o método do modelo
		const report = await Marks.getStudentReport(studentId, classId);

		res.json({
			success: true,
			data: report
		});
	} catch (err) { next(err); }
};

/**
 * Calcula a média de um aluno em uma disciplina
 */
exports.calculateAverage = async (req, res, next) => {
	try {
		const { studentId, subjectId, classId, evaluationPeriod } = req.params;

		// Verificar se o aluno, a disciplina e a classe existem
		const [student, subject, classObj] = await Promise.all([
			Student.findOne({ _id: studentId, school: req.user.school }),
			Subjects.findOne({ _id: subjectId, school: req.user.school }),
			Classes.findOne({ _id: classId, school: req.user.school })
		]);

		if (!student) {
			return res.status(404).json(createErrorResponse('Student not found'));
		}

		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		if (!classObj) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		// Calcular a média usando o método do modelo
		const average = await Marks.calculateAverage(studentId, subjectId, classId, evaluationPeriod);

		res.json({
			success: true,
			data: average
		});
	} catch (err) { next(err); }
};

/**
 * Verifica a aprovação de um aluno em uma disciplina
 */
exports.checkApproval = async (req, res, next) => {
	try {
		const { studentId, subjectId, classId } = req.params;

		// Verificar se o aluno, a disciplina e a classe existem
		const [student, subject, classObj] = await Promise.all([
			Student.findOne({ _id: studentId, school: req.user.school }),
			Subjects.findOne({ _id: subjectId, school: req.user.school }),
			Classes.findOne({ _id: classId, school: req.user.school })
		]);

		if (!student) {
			return res.status(404).json(createErrorResponse('Student not found'));
		}

		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		if (!classObj) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		// Verificar aprovação usando o método do modelo
		const approval = await Marks.checkApproval(studentId, subjectId, classId);

		res.json({
			success: true,
			data: approval
		});
	} catch (err) { next(err); }
};

/**
 * Gera relatório de desempenho da turma
 */
exports.generateClassReport = async (req, res, next) => {
	try {
		const { classId } = req.params;

		// Verificar se a classe existe
		const classObj = await Classes.findOne({
			_id: classId,
			school: req.user.school
		});

		if (!classObj) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		// Buscar todas as matrículas nesta classe
		const enrollments = await Enrollment.find({
			class: classId,
			status: { $in: ['studying', 'approved', 'failed'] }
		}).populate('student', 'firstName lastName registrationNumber');

		// Buscar todas as disciplinas desta classe
		const subjects = await Subjects.find({
			classes: classId
		});

		// Para cada aluno, gerar relatório de desempenho
		const studentReports = await Promise.all(
			enrollments.map(async (enrollment) => {
				const studentReport = await Marks.getStudentReport(enrollment.student._id, classId);
				return {
					student: enrollment.student,
					report: studentReport
				};
			})
		);

		// Calcular estatísticas da turma
		const classStats = {
			totalStudents: enrollments.length,
			approvedStudents: studentReports.filter(r => r.report.approved).length,
			subjectStats: []
		};

		// Calcular estatísticas por disciplina
		for (const subject of subjects) {
			const subjectResults = studentReports.map(r => {
				const subjectReport = r.report.subjects.find(s => s.subject._id.toString() === subject._id.toString());
				return subjectReport || { approved: false, average: 0 };
			});

			const approvedCount = subjectResults.filter(r => r.approved).length;
			const averageSum = subjectResults.reduce((sum, r) => sum + r.average, 0);

			classStats.subjectStats.push({
				subject: {
					_id: subject._id,
					name: subject.name,
					code: subject.code,
					type: subject.type
				},
				approvedCount,
				approvalRate: enrollments.length > 0 ? (approvedCount / enrollments.length) * 100 : 0,
				averageGrade: enrollments.length > 0 ? averageSum / enrollments.length : 0
			});
		}

		// Calcular taxa de aprovação geral
		classStats.approvalRate = enrollments.length > 0
			? (classStats.approvedStudents / enrollments.length) * 100
			: 0;

		res.json({
			success: true,
			data: {
				class: {
					_id: classObj._id,
					name: classObj.name,
					yearLevel: classObj.yearLevel,
					academicYear: classObj.academicYear
				},
				stats: classStats,
				studentReports
			}
		});
	} catch (err) { next(err); }
};

/**
 * Importa notas em lote
 */
exports.bulkImport = async (req, res, next) => {
	try {
		const { marks } = req.body;

		if (!Array.isArray(marks) || marks.length === 0) {
			return res.status(400).json(createErrorResponse('Invalid marks data'));
		}

		// Validar cada nota
		for (const mark of marks) {
			if (!mark.student || !mark.subject || !mark.class || !mark.evaluationPeriod ||
				!mark.evaluationType || !mark.title || mark.grade === undefined) {
				return res.status(400).json(createErrorResponse('Missing required fields in one or more marks'));
			}
		}

		// Adicionar campos comuns a todas as notas
		const processedMarks = marks.map(mark => ({
			...mark,
			school: req.user.school,
			registeredBy: req.user._id,
			date: mark.date || new Date(),
			weight: mark.weight || 1,
			status: mark.status || 'published',
			isRecovery: mark.isRecovery || false
		}));

		// Inserir notas em lote
		const result = await Marks.insertMany(processedMarks);

		res.status(201).json({
			success: true,
			data: {
				count: result.length,
				message: `${result.length} marks imported successfully`
			}
		});
	} catch (err) { next(err); }
};

/**
 * Obtém estatísticas de desempenho para uma disciplina
 */
exports.getSubjectStatistics = async (req, res, next) => {
	try {
		const { subjectId, academicYearId } = req.params;

		// Verificar se a disciplina existe
		const subject = await Subject.findById(subjectId);
		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		// Buscar todas as turmas que têm esta disciplina
		const classes = await Classes.find({
			academicYear: academicYearId,
			subjects: subjectId
		});

		// Para cada turma, calcular estatísticas
		const classStatistics = await Promise.all(
			classes.map(async (classObj) => {
				// Buscar alunos da turma
				const Enrollment = mongoose.model('Enrollment');
				const enrollments = await Enrollment.find({
					class: classObj._id,
					academicYear: academicYearId,
					status: 'active'
				});

				const studentIds = enrollments.map(e => e.student._id);

				// Buscar notas desta disciplina para esta turma
				const marks = await Marks.find({
					class: classObj._id,
					academicYear: academicYearId,
					subject: subjectId,
					student: { $in: studentIds }
				});

				// Agrupar notas por aluno
				const marksByStudent = {};
				marks.forEach(mark => {
					const studentId = mark.student.toString();
					if (!marksByStudent[studentId]) {
						marksByStudent[studentId] = [];
					}
					marksByStudent[studentId].push(mark);
				});

				// Calcular médias por aluno
				const studentAverages = [];
				Object.keys(marksByStudent).forEach(studentId => {
					const studentMarks = marksByStudent[studentId];
					let totalWeight = 0;
					let weightedSum = 0;

					studentMarks.forEach(mark => {
						weightedSum += mark.grade * mark.weight;
						totalWeight += mark.weight;
					});

					const average = totalWeight > 0 ? weightedSum / totalWeight : 0;
					studentAverages.push(average);
				});

				// Calcular estatísticas da turma
				const studentsWithMarks = studentAverages.length;
				const minGradeToPass = subject.minGradeToPass || 6;
				const approvedStudents = studentAverages.filter(avg => avg >= minGradeToPass).length;
				const classAverage = studentsWithMarks > 0
					? parseFloat((studentAverages.reduce((sum, avg) => sum + avg, 0) / studentsWithMarks).toFixed(2))
					: 0;

				return {
					class: {
						_id: classObj._id,
						name: classObj.name
					},
					statistics: {
						totalStudents: enrollments.length,
						studentsWithMarks,
						approvedStudents,
						failedStudents: studentsWithMarks - approvedStudents,
						approvalRate: studentsWithMarks > 0
							? parseFloat(((approvedStudents / studentsWithMarks) * 100).toFixed(2))
							: 0,
						classAverage
					}
				};
			})
		);

		// Calcular estatísticas gerais da disciplina
		const totalClasses = classes.length;
		const totalStudents = classStatistics.reduce((sum, c) => sum + c.statistics.totalStudents, 0);
		const studentsWithMarks = classStatistics.reduce((sum, c) => sum + c.statistics.studentsWithMarks, 0);
		const approvedStudents = classStatistics.reduce((sum, c) => sum + c.statistics.approvedStudents, 0);
		const failedStudents = classStatistics.reduce((sum, c) => sum + c.statistics.failedStudents, 0);

		// Calcular média geral da disciplina
		const overallAverage = studentsWithMarks > 0
			? parseFloat((classStatistics.reduce((sum, c) => sum + (c.statistics.classAverage * c.statistics.studentsWithMarks), 0) / studentsWithMarks).toFixed(2))
			: 0;

		return res.status(200).json({
			success: true,
			data: {
				subject: {
					_id: subject._id,
					name: subject.name,
					code: subject.code,
					type: subject.type
				},
				academicYear: academicYearId,
				statistics: {
					totalClasses,
					totalStudents,
					studentsWithMarks,
					approvedStudents,
					failedStudents,
					approvalRate: studentsWithMarks > 0
						? parseFloat(((approvedStudents / studentsWithMarks) * 100).toFixed(2))
						: 0,
					overallAverage
				},
				classStatistics
			}
		});
	} catch (err) { next(err); }
};