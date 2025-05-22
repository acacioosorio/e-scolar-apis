// Marks Controller
// ./api/marks/marks.controller.js

const mongoose = require('mongoose');
const Marks = require('./marks.model');
const Student = mongoose.model('Student');
const Subject = mongoose.model('Subjects');
const Classes = mongoose.model('Classes');
const AcademicYear = mongoose.model('AcademicYear');
const { createErrorResponse } = require('../../helpers');

/**
 * Cria um novo registro de nota
 */
exports.createMark = async (req, res, next) => {
	try {
		const school = req.query.id || req.user?.school;

		const {
			student,
			subject,
			academicYear,
			class: classId,
			evaluationPeriod,
			evaluationType,
			title,
			grade,
			weight,
			date,
			comments,
			status,
			isRecovery
		} = req.body;

		// Validar dados obrigatórios
		if (!school || !student || !subject || !academicYear || !classId ||
			!evaluationPeriod || !evaluationType || !title || grade === undefined) {
			return res.status(400).json(createErrorResponse('Missing required fields'));
		}

		// Validar nota (entre 0 e 10)
		if (grade < 0 || grade > 10) {
			return res.status(400).json(createErrorResponse('Grade must be between 0 and 10'));
		}

		// Verificar se o aluno existe
		const studentExists = await Student.findById(student);
		if (!studentExists) {
			return res.status(404).json(createErrorResponse('Student not found'));
		}

		// Verificar se a disciplina existe
		const subjectExists = await Subject.findById(subject);
		if (!subjectExists) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		// Verificar se a turma existe
		const classExists = await Classes.findById(classId);
		if (!classExists) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		// Verificar se o ano acadêmico existe
		const academicYearExists = await AcademicYear.findById(academicYear);
		if (!academicYearExists) {
			return res.status(404).json(createErrorResponse('Academic year not found'));
		}

		// Criar o registro de nota
		const mark = await Marks.create({
			school,
			student,
			subject,
			academicYear,
			class: classId,
			evaluationPeriod,
			evaluationType,
			title,
			grade,
			weight: weight || 1,
			date: date || new Date(),
			comments,
			status: status || 'published',
			isRecovery: isRecovery || false,
			registeredBy: req.user._id // Usuário autenticado que está registrando a nota
		});

		return res.status(201).json({
			success: true,
			data: mark,
			message: 'Mark created successfully'
		});
	} catch (err) { next(err); }
};

/**
 * Lista registros de notas com filtros
 */
exports.listMarks = async (req, res, next) => {
	try {
		// Extrair parâmetros de consulta
		const {
			school,
			student,
			subject,
			academicYear,
			class: classId,
			evaluationPeriod,
			evaluationType,
			startDate,
			endDate,
			page = parseInt(req.query.page) || 1,
			limit = parseInt(req.query.limit) || 10,
			sortBy = 'order',
			sort = '-createdAt',
			order = req.query.order === 'desc' ? -1 : 1
		} = req.query;

		const skip = (page - 1) * limit;

		// Construir filtro de consulta
		const filter = {};

		if (school) filter.school = school;
		if (student) filter.student = student;
		if (subject) filter.subject = subject;
		if (academicYear) filter.academicYear = academicYear;
		if (classId) filter.class = classId;
		if (evaluationPeriod) filter.evaluationPeriod = evaluationPeriod;
		if (evaluationType) filter.evaluationType = evaluationType;

		// Filtro por data
		if (startDate || endDate) {
			filter.date = {};
			if (startDate) filter.date.$gte = new Date(startDate);
			if (endDate) filter.date.$lte = new Date(endDate);
		}

		const [totalCount, marks] = await Promise.all([
			Marks.countDocuments(filter),
			Marks.find(filter)
				.sort({ [sortBy]: order === 'desc' ? -1 : 1 })
				.skip(+skip).limit(+limit)
				.populate('student', 'name admissionNumber')
				.populate('subject', 'name code')
				.populate('class', 'name')
				.populate('academicYear', 'name')
				.populate('registeredBy', 'name')
		]);

		// Contar total de registros para paginação
		const totalPages = Math.ceil(totalCount / limit);

		res.status(200).send({
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

		// return res.status(200).json({
		// 	success: true,
		// 	data: marks,
		// 	pagination: {
		// 		total,
		// 		page: parseInt(page),
		// 		limit: parseInt(limit),
		// 		pages: Math.ceil(total / limit)
		// 	}
		// });
	} catch (err) { next(err); }
};

/**
 * Obtém um registro de nota específico
 */
exports.getMark = async (req, res, next) => {
	try {
		const { id } = req.params;

		// Buscar a nota com população de referências
		const mark = await Marks.findById(id)
			.populate('student', 'name admissionNumber')
			.populate('subject', 'name code')
			.populate('class', 'name')
			.populate('academicYear', 'name')
			.populate('registeredBy', 'name');

		if (!mark) {
			return res.status(404).json(createErrorResponse('Mark not found'));
		}

		return res.status(200).json({
			success: true,
			data: mark
		});
	} catch (err) { next(err); }
};

/**
 * Atualiza um registro de nota
 */
exports.updateMark = async (req, res, next) => {
	try {
		const { id } = req.params;
		const updateData = req.body;

		// Verificar se a nota existe
		const mark = await Marks.findById(id);
		if (!mark) {
			return res.status(404).json(createErrorResponse('Mark not found'));
		}

		// Validar nota (entre 0 e 10) se fornecida
		if (updateData.grade !== undefined && (updateData.grade < 0 || updateData.grade > 10)) {
			return res.status(400).json(createErrorResponse('Grade must be between 0 and 10'));
		}

		// Não permitir alteração de campos críticos
		delete updateData.student;
		delete updateData.subject;
		delete updateData.academicYear;
		delete updateData.class;
		delete updateData.school;
		delete updateData.registeredBy;

		// Registrar quem atualizou a nota
		updateData.updatedBy = req.user._id;

		// Atualizar o registro
		const updatedMark = await Marks.findByIdAndUpdate(
			id,
			{ $set: updateData },
			{ new: true, runValidators: true }
		).populate('student', 'name admissionNumber')
			.populate('subject', 'name code');

		return res.status(200).json({
			success: true,
			data: updatedMark,
			message: 'Mark updated successfully'
		});
	} catch (err) { next(err); }
};

/**
 * Remove um registro de nota
 */
exports.deleteMark = async (req, res, next) => {
	try {
		const { id } = req.params;

		// Verificar se a nota existe
		const mark = await Marks.findById(id);
		if (!mark) {
			return res.status(404).json(createErrorResponse('Mark not found'));
		}

		// Verificar permissões (apenas administradores ou o professor que registrou)
		const isAdmin = req.user.role === 'admin';
		const isOwner = mark.registeredBy.toString() === req.user._id.toString();

		if (!isAdmin && !isOwner) {
			return res.status(403).json(createErrorResponse('You do not have permission to delete this mark'));
		}

		// Remover o registro
		await Marks.findByIdAndDelete(id);

		return res.status(200).json({
			success: true,
			message: 'Mark deleted successfully'
		});
	} catch (err) { next(err); }
};

/**
 * Calcula a média de um aluno em uma disciplina
 */
exports.calculateAverage = async (req, res, next) => {
	try {
		const { studentId, subjectId, academicYearId, evaluationPeriod } = req.params;

		// Construir filtro para buscar notas
		const filter = {
			student: studentId,
			subject: subjectId,
			academicYear: academicYearId
		};

		// Adicionar período de avaliação se fornecido
		if (evaluationPeriod) {
			filter.evaluationPeriod = evaluationPeriod;
		}

		// Buscar notas
		const marks = await Marks.find(filter);

		// Calcular média ponderada
		let totalWeight = 0;
		let weightedSum = 0;

		marks.forEach(mark => {
			weightedSum += mark.grade * mark.weight;
			totalWeight += mark.weight;
		});

		const average = totalWeight > 0 ? weightedSum / totalWeight : 0;

		// Buscar informações da disciplina para verificar aprovação
		const subject = await Subject.findById(subjectId);
		const minGradeToPass = subject ? subject.minGradeToPass || 6 : 6;

		return res.status(200).json({
			success: true,
			data: {
				student: studentId,
				subject: subjectId,
				academicYear: academicYearId,
				evaluationPeriod: evaluationPeriod || 'all',
				totalMarks: marks.length,
				average: parseFloat(average.toFixed(2)),
				approved: average >= minGradeToPass,
				minGradeToPass
			}
		});
	} catch (err) { next(err); }
};

/**
 * Verifica aprovação de um aluno em uma disciplina
 */
exports.checkApproval = async (req, res, next) => {
	try {
		const { studentId, subjectId, academicYearId } = req.params;

		// Buscar todas as notas do aluno nesta disciplina
		const marks = await Marks.find({
			student: studentId,
			subject: subjectId,
			academicYear: academicYearId
		});

		// Buscar informações da disciplina
		const subject = await Subject.findById(subjectId);
		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		const minGradeToPass = subject.minGradeToPass || 6;

		// Verificar se há notas de recuperação
		const recoveryMarks = marks.filter(mark => mark.isRecovery);

		// Calcular média das notas regulares
		const regularMarks = marks.filter(mark => !mark.isRecovery);

		let regularAverage = 0;
		if (regularMarks.length > 0) {
			let totalWeight = 0;
			let weightedSum = 0;

			regularMarks.forEach(mark => {
				weightedSum += mark.grade * mark.weight;
				totalWeight += mark.weight;
			});

			regularAverage = totalWeight > 0 ? weightedSum / totalWeight : 0;
		}

		// Calcular média final considerando recuperação
		let finalAverage = regularAverage;
		let recoveryGrade = null;

		if (recoveryMarks.length > 0 && regularAverage < minGradeToPass) {
			// Pegar a nota de recuperação mais recente
			const latestRecovery = recoveryMarks.sort((a, b) =>
				new Date(b.date) - new Date(a.date)
			)[0];

			recoveryGrade = latestRecovery.grade;

			// Calcular média final (pode variar conforme regras da escola)
			// Exemplo: média aritmética entre média regular e recuperação
			finalAverage = (regularAverage + recoveryGrade) / 2;
		}

		// Determinar status final
		const approved = finalAverage >= minGradeToPass;
		const finalStatus = approved ? 'approved' : 'failed';

		return res.status(200).json({
			success: true,
			data: {
				student: studentId,
				subject: subjectId,
				academicYear: academicYearId,
				regularAverage: parseFloat(regularAverage.toFixed(2)),
				recoveryGrade: recoveryGrade !== null ? parseFloat(recoveryGrade.toFixed(2)) : null,
				finalAverage: parseFloat(finalAverage.toFixed(2)),
				minGradeToPass,
				approved,
				finalStatus
			}
		});
	} catch (err) { next(err); }
};

/**
 * Gera o boletim de um aluno
 */
exports.getStudentReport = async (req, res, next) => {
	try {
		const { studentId, academicYearId, classId } = req.params;

		// Verificar se o aluno existe
		const student = await Student.findById(studentId);
		if (!student) {
			return res.status(404).json(createErrorResponse('Student not found'));
		}

		// Verificar se a turma existe
		const classObj = await Classes.findById(classId);
		if (!classObj) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		// Buscar todas as disciplinas da turma
		const subjects = await Subject.find({
			classes: classId,
			academicYear: academicYearId
		});

		// Para cada disciplina, calcular média e verificar aprovação
		const subjectResults = await Promise.all(
			subjects.map(async (subject) => {
				// Buscar todas as notas do aluno nesta disciplina
				const marks = await Marks.find({
					student: studentId,
					subject: subject._id,
					academicYear: academicYearId
				});

				// Agrupar notas por período
				const marksByPeriod = {};
				marks.forEach(mark => {
					if (!marksByPeriod[mark.evaluationPeriod]) {
						marksByPeriod[mark.evaluationPeriod] = [];
					}
					marksByPeriod[mark.evaluationPeriod].push({
						_id: mark._id,
						title: mark.title,
						evaluationType: mark.evaluationType,
						grade: mark.grade,
						weight: mark.weight,
						date: mark.date,
						isRecovery: mark.isRecovery
					});
				});

				// Calcular média por período
				const periodAverages = {};
				Object.keys(marksByPeriod).forEach(period => {
					const periodMarks = marksByPeriod[period];
					let totalWeight = 0;
					let weightedSum = 0;

					periodMarks.forEach(mark => {
						weightedSum += mark.grade * mark.weight;
						totalWeight += mark.weight;
					});

					periodAverages[period] = totalWeight > 0
						? parseFloat((weightedSum / totalWeight).toFixed(2))
						: 0;
				});

				// Verificar aprovação
				const minGradeToPass = subject.minGradeToPass || 6;

				// Verificar se há notas de recuperação
				const recoveryMarks = marks.filter(mark => mark.isRecovery);

				// Calcular média das notas regulares
				const regularMarks = marks.filter(mark => !mark.isRecovery);

				let regularAverage = 0;
				if (regularMarks.length > 0) {
					let totalWeight = 0;
					let weightedSum = 0;

					regularMarks.forEach(mark => {
						weightedSum += mark.grade * mark.weight;
						totalWeight += mark.weight;
					});

					regularAverage = totalWeight > 0 ? weightedSum / totalWeight : 0;
				}

				// Calcular média final considerando recuperação
				let finalAverage = regularAverage;
				let recoveryGrade = null;

				if (recoveryMarks.length > 0 && regularAverage < minGradeToPass) {
					// Pegar a nota de recuperação mais recente
					const latestRecovery = recoveryMarks.sort((a, b) =>
						new Date(b.date) - new Date(a.date)
					)[0];

					recoveryGrade = latestRecovery.grade;

					// Calcular média final (pode variar conforme regras da escola)
					// Exemplo: média aritmética entre média regular e recuperação
					finalAverage = (regularAverage + recoveryGrade) / 2;
				}

				// Determinar status final
				const approved = finalAverage >= minGradeToPass;
				const finalStatus = approved ? 'approved' : 'failed';

				return {
					subject: {
						_id: subject._id,
						name: subject.name,
						code: subject.code,
						type: subject.type
					},
					regularAverage: parseFloat(regularAverage.toFixed(2)),
					recoveryGrade: recoveryGrade !== null ? parseFloat(recoveryGrade.toFixed(2)) : null,
					finalAverage: parseFloat(finalAverage.toFixed(2)),
					minGradeToPass,
					approved,
					finalStatus,
					periodAverages,
					marksByPeriod
				};
			})
		);

		// Calcular estatísticas gerais
		const totalSubjects = subjectResults.length;
		const approvedSubjects = subjectResults.filter(r => r.approved).length;
		const failedSubjects = totalSubjects - approvedSubjects;

		// Determinar status geral (aprovado se aprovado em todas as disciplinas)
		const overallApproved = failedSubjects === 0;
		const overallStatus = overallApproved ? 'approved' : 'failed';

		return res.status(200).json({
			success: true,
			data: {
				student: {
					_id: student._id,
					name: student.name,
					admissionNumber: student.admissionNumber
				},
				class: {
					_id: classObj._id,
					name: classObj.name
				},
				academicYear: academicYearId,
				statistics: {
					totalSubjects,
					approvedSubjects,
					failedSubjects,
					approvalRate: totalSubjects > 0
						? parseFloat(((approvedSubjects / totalSubjects) * 100).toFixed(2))
						: 0
				},
				overallStatus,
				subjects: subjectResults
			}
		});
	} catch (err) { next(err); }
};

/**
 * Obtém estatísticas de desempenho para uma turma
 */
exports.getClassStatistics = async (req, res, next) => {
	try {
		const { classId, academicYearId, subjectId } = req.params;

		// Verificar se a turma existe
		const classExists = await Classes.findById(classId);
		if (!classExists) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		// Buscar alunos da turma
		const Enrollment = mongoose.model('Enrollment');
		const enrollments = await Enrollment.find({
			class: classId,
			academicYear: academicYearId,
			status: 'active'
		}).populate('student', 'name admissionNumber');

		const studentIds = enrollments.map(e => e.student._id);

		// Filtro para consulta de notas
		const filter = {
			class: classId,
			academicYear: academicYearId,
			student: { $in: studentIds }
		};

		// Se uma disciplina específica for fornecida
		if (subjectId) {
			filter.subject = subjectId;

			// Verificar se a disciplina existe
			const subject = await Subject.findById(subjectId);
			if (!subject) {
				return res.status(404).json(createErrorResponse('Subject not found'));
			}

			// Buscar todas as notas
			const marks = await Marks.find(filter);

			// Agrupar notas por aluno
			const marksByStudent = {};
			marks.forEach(mark => {
				const studentId = mark.student.toString();
				if (!marksByStudent[studentId]) {
					marksByStudent[studentId] = [];
				}
				marksByStudent[studentId].push(mark);
			});

			// Calcular estatísticas por aluno
			const studentResults = await Promise.all(
				enrollments.map(async (enrollment) => {
					const studentId = enrollment.student._id.toString();
					const studentMarks = marksByStudent[studentId] || [];

					// Calcular média
					let average = 0;
					if (studentMarks.length > 0) {
						let totalWeight = 0;
						let weightedSum = 0;

						studentMarks.forEach(mark => {
							weightedSum += mark.grade * mark.weight;
							totalWeight += mark.weight;
						});

						average = totalWeight > 0 ? weightedSum / totalWeight : 0;
					}

					// Verificar aprovação
					const minGradeToPass = subject.minGradeToPass || 6;
					const approved = average >= minGradeToPass;

					return {
						student: {
							_id: enrollment.student._id,
							name: enrollment.student.name,
							admissionNumber: enrollment.student.admissionNumber
						},
						average: parseFloat(average.toFixed(2)),
						approved,
						totalMarks: studentMarks.length
					};
				})
			);

			// Calcular estatísticas gerais
			const totalStudents = studentResults.length;
			const studentsWithMarks = studentResults.filter(r => r.totalMarks > 0).length;
			const approvedStudents = studentResults.filter(r => r.approved).length;
			const failedStudents = studentResults.filter(r => !r.approved && r.totalMarks > 0).length;

			// Calcular média geral da turma
			const classAverage = totalStudents > 0
				? parseFloat((studentResults.reduce((sum, r) => sum + r.average, 0) / totalStudents).toFixed(2))
				: 0;

			return res.status(200).json({
				success: true,
				data: {
					class: {
						_id: classExists._id,
						name: classExists.name
					},
					subject: {
						_id: subject._id,
						name: subject.name,
						code: subject.code
					},
					academicYear: academicYearId,
					statistics: {
						totalStudents,
						studentsWithMarks,
						approvedStudents,
						failedStudents,
						approvalRate: studentsWithMarks > 0
							? parseFloat(((approvedStudents / studentsWithMarks) * 100).toFixed(2))
							: 0,
						classAverage
					},
					studentResults: studentResults.sort((a, b) => b.average - a.average) // Ordenar por média decrescente
				}
			});
		} else {
			// Se nenhuma disciplina específica for fornecida, retornar estatísticas gerais

			// Buscar todas as disciplinas da turma
			const subjects = await Subject.find({
				classes: classId,
				academicYear: academicYearId
			});

			// Para cada disciplina, calcular estatísticas
			const subjectStatistics = await Promise.all(
				subjects.map(async (subject) => {
					// Buscar notas desta disciplina
					const subjectMarks = await Marks.find({
						class: classId,
						academicYear: academicYearId,
						subject: subject._id,
						student: { $in: studentIds }
					});

					// Agrupar notas por aluno
					const marksByStudent = {};
					subjectMarks.forEach(mark => {
						const studentId = mark.student.toString();
						if (!marksByStudent[studentId]) {
							marksByStudent[studentId] = [];
						}
						marksByStudent[studentId].push(mark);
					});

					// Calcular médias por aluno
					const studentAverages = [];
					Object.keys(marksByStudent).forEach(studentId => {
						const marks = marksByStudent[studentId];
						let totalWeight = 0;
						let weightedSum = 0;

						marks.forEach(mark => {
							weightedSum += mark.grade * mark.weight;
							totalWeight += mark.weight;
						});

						const average = totalWeight > 0 ? weightedSum / totalWeight : 0;
						studentAverages.push(average);
					});

					// Calcular estatísticas da disciplina
					const studentsWithMarks = studentAverages.length;
					const minGradeToPass = subject.minGradeToPass || 6;
					const approvedStudents = studentAverages.filter(avg => avg >= minGradeToPass).length;
					const subjectAverage = studentsWithMarks > 0
						? parseFloat((studentAverages.reduce((sum, avg) => sum + avg, 0) / studentsWithMarks).toFixed(2))
						: 0;

					return {
						subject: {
							_id: subject._id,
							name: subject.name,
							code: subject.code,
							type: subject.type
						},
						statistics: {
							totalStudents: enrollments.length,
							studentsWithMarks,
							approvedStudents,
							failedStudents: studentsWithMarks - approvedStudents,
							approvalRate: studentsWithMarks > 0
								? parseFloat(((approvedStudents / studentsWithMarks) * 100).toFixed(2))
								: 0,
							subjectAverage
						}
					};
				})
			);

			// Calcular estatísticas gerais da turma
			const totalSubjects = subjects.length;

			return res.status(200).json({
				success: true,
				data: {
					class: {
						_id: classExists._id,
						name: classExists.name
					},
					academicYear: academicYearId,
					statistics: {
						totalStudents: enrollments.length,
						totalSubjects
					},
					subjectStatistics
				}
			});
		}
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

module.exports = exports;
