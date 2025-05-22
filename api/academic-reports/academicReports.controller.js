// Academic Reports Controller
// ./api/academic-reports/academicReports.controller.js

const mongoose = require('mongoose');
const AcademicEvaluationService = require('../academic-progress/academicEvaluation.service');
const AcademicProgress = mongoose.model('AcademicProgress');
const Marks = mongoose.model('Marks');
const Classes = mongoose.model('Classes');
const Student = mongoose.model('Student');
const Subject = mongoose.model('Subjects');
const YearLevel = mongoose.model('YearLevel');
const AcademicYear = mongoose.model('AcademicYear');
const { createErrorResponse } = require('../../helpers');

/**
 * Gera o boletim escolar de um aluno
 */
exports.getStudentReport = async (req, res, next) => {
	try {
		const { studentId, academicYearId } = req.params;

		// Verificar permissões (implementação depende da lógica de autenticação)
		// ...

		// Gerar o boletim
		const report = await AcademicEvaluationService.generateStudentReport(
			studentId,
			academicYearId
		);

		return res.status(200).json({
			success: true,
			data: report
		});
	} catch (err) { next(err); }
};

/**
 * Gera relatório de desempenho de uma turma
 */
exports.getClassReport = async (req, res, next) => {
	try {
		const { classId, academicYearId } = req.params;

		// Verificar permissões (implementação depende da lógica de autenticação)
		// ...

		// Gerar o relatório da turma
		const report = await AcademicEvaluationService.generateClassReport(
			classId,
			academicYearId
		);

		return res.status(200).json({
			success: true,
			data: report
		});
	} catch (err) { next(err); }
};

/**
 * Gera relatório de desempenho por disciplina
 */
exports.getSubjectReport = async (req, res, next) => {
	try {
		const { subjectId, classId, academicYearId } = req.params;

		// Verificar permissões (implementação depende da lógica de autenticação)
		// ...

		// Buscar a disciplina
		const subject = await Subject.findById(subjectId);
		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		// Buscar todos os alunos da turma
		const Enrollment = mongoose.model('Enrollment');
		const enrollments = await Enrollment.find({
			class: classId,
			academicYear: academicYearId,
			status: 'active'
		}).populate('student', 'name admissionNumber');

		// Para cada aluno, verificar aprovação na disciplina
		const studentResults = await Promise.all(
			enrollments.map(async (enrollment) => {
				const result = await AcademicEvaluationService.calculateSubjectFinalGrade(
					enrollment.student._id,
					subjectId,
					academicYearId
				);

				return {
					student: {
						_id: enrollment.student._id,
						name: enrollment.student.name,
						admissionNumber: enrollment.student.admissionNumber
					},
					average: result.average,
					approved: result.approved,
					finalStatus: result.finalStatus,
					recoveryGrade: result.recoveryGrade
				};
			})
		);

		// Calcular estatísticas
		const totalStudents = studentResults.length;
		const approvedStudents = studentResults.filter(r => r.approved).length;
		const failedStudents = totalStudents - approvedStudents;
		const approvalRate = totalStudents > 0
			? parseFloat(((approvedStudents / totalStudents) * 100).toFixed(2))
			: 0;

		const averageGrade = totalStudents > 0
			? parseFloat((studentResults.reduce((sum, r) => sum + r.average, 0) / totalStudents).toFixed(2))
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
				class: classId,
				academicYear: academicYearId,
				statistics: {
					totalStudents,
					approvedStudents,
					failedStudents,
					approvalRate,
					averageGrade
				},
				studentResults: studentResults.sort((a, b) => b.average - a.average) // Ordenar por média decrescente
			}
		});
	} catch (err) { next(err); }
};

/**
 * Gera relatório de desempenho por nível de ano
 */
exports.getYearLevelReport = async (req, res, next) => {
	try {
		const { yearLevelId, academicYearId, schoolId } = req.params;

		// Verificar permissões (implementação depende da lógica de autenticação)
		// ...

		// Buscar todas as turmas deste nível de ano
		const classes = await Classes.find({
			yearLevel: yearLevelId,
			academicYear: academicYearId,
			school: schoolId
		});

		if (!classes.length) {
			return res.status(404).json(createErrorResponse('No classes found for this year level'));
		}

		// Buscar progresso acadêmico de todos os alunos nestas turmas
		const classIds = classes.map(c => c._id);
		const progressRecords = await AcademicProgress.find({
			class: { $in: classIds },
			academicYear: academicYearId,
			school: schoolId
		}).populate('student', 'name admissionNumber')
			.populate('class', 'name');

		// Calcular estatísticas por turma
		const classSummaries = await Promise.all(
			classes.map(async (classObj) => {
				const classProgress = progressRecords.filter(
					p => p.class._id.toString() === classObj._id.toString()
				);

				const totalStudents = classProgress.length;
				const approvedStudents = classProgress.filter(p => p.overallStatus === 'approved').length;
				const failedStudents = classProgress.filter(p => p.overallStatus === 'failed').length;
				const pendingStudents = classProgress.filter(p => p.overallStatus === 'pending').length;

				return {
					class: {
						_id: classObj._id,
						name: classObj.name
					},
					statistics: {
						totalStudents,
						approvedStudents,
						failedStudents,
						pendingStudents,
						approvalRate: totalStudents > 0
							? parseFloat(((approvedStudents / totalStudents) * 100).toFixed(2))
							: 0
					}
				};
			})
		);

		// Calcular estatísticas gerais do nível
		const totalStudents = progressRecords.length;
		const approvedStudents = progressRecords.filter(p => p.overallStatus === 'approved').length;
		const failedStudents = progressRecords.filter(p => p.overallStatus === 'failed').length;
		const pendingStudents = progressRecords.filter(p => p.overallStatus === 'pending').length;

		// Buscar informações do nível de ano
		const yearLevel = await YearLevel.findById(yearLevelId);
		const academicYear = await AcademicYear.findById(academicYearId);

		return res.status(200).json({
			success: true,
			data: {
				yearLevel: {
					_id: yearLevel._id,
					name: yearLevel.name
				},
				academicYear: {
					_id: academicYear._id,
					name: academicYear.name
				},
				school: schoolId,
				statistics: {
					totalStudents,
					approvedStudents,
					failedStudents,
					pendingStudents,
					approvalRate: totalStudents > 0
						? parseFloat(((approvedStudents / totalStudents) * 100).toFixed(2))
						: 0,
					totalClasses: classes.length
				},
				classSummaries
			}
		});
	} catch (err) { next(err); }
};

/**
 * Gera relatório de desempenho geral da escola
 */
exports.getSchoolReport = async (req, res, next) => {
	try {
		const { schoolId, academicYearId } = req.params;

		// Verificar permissões (implementação depende da lógica de autenticação)
		// ...

		// Buscar todos os níveis de ano da escola
		const yearLevels = await YearLevel.find({
			school: schoolId
		}).sort({ order: 1 });

		// Para cada nível, buscar estatísticas
		const yearLevelSummaries = await Promise.all(
			yearLevels.map(async (yearLevel) => {
				// Buscar turmas deste nível
				const classes = await Classes.find({
					yearLevel: yearLevel._id,
					academicYear: academicYearId,
					school: schoolId
				});

				const classIds = classes.map(c => c._id);

				// Buscar progresso acadêmico
				const progressRecords = await AcademicProgress.find({
					class: { $in: classIds },
					academicYear: academicYearId,
					school: schoolId
				});

				const totalStudents = progressRecords.length;
				const approvedStudents = progressRecords.filter(p => p.overallStatus === 'approved').length;
				const failedStudents = progressRecords.filter(p => p.overallStatus === 'failed').length;
				const pendingStudents = progressRecords.filter(p => p.overallStatus === 'pending').length;

				return {
					yearLevel: {
						_id: yearLevel._id,
						name: yearLevel.name
					},
					statistics: {
						totalStudents,
						approvedStudents,
						failedStudents,
						pendingStudents,
						approvalRate: totalStudents > 0
							? parseFloat(((approvedStudents / totalStudents) * 100).toFixed(2))
							: 0,
						totalClasses: classes.length
					}
				};
			})
		);

		// Calcular estatísticas gerais da escola
		const totalStudents = yearLevelSummaries.reduce((sum, yl) => sum + yl.statistics.totalStudents, 0);
		const approvedStudents = yearLevelSummaries.reduce((sum, yl) => sum + yl.statistics.approvedStudents, 0);
		const failedStudents = yearLevelSummaries.reduce((sum, yl) => sum + yl.statistics.failedStudents, 0);
		const pendingStudents = yearLevelSummaries.reduce((sum, yl) => sum + yl.statistics.pendingStudents, 0);
		const totalClasses = yearLevelSummaries.reduce((sum, yl) => sum + yl.statistics.totalClasses, 0);

		// Buscar informações da escola e ano acadêmico
		const School = mongoose.model('School');
		const school = await School.findById(schoolId);
		const academicYear = await AcademicYear.findById(academicYearId);

		return res.status(200).json({
			success: true,
			data: {
				school: {
					_id: school._id,
					name: school.name
				},
				academicYear: {
					_id: academicYear._id,
					name: academicYear.name
				},
				statistics: {
					totalStudents,
					approvedStudents,
					failedStudents,
					pendingStudents,
					approvalRate: totalStudents > 0
						? parseFloat(((approvedStudents / totalStudents) * 100).toFixed(2))
						: 0,
					totalClasses,
					totalYearLevels: yearLevels.length
				},
				yearLevelSummaries
			}
		});
	} catch (err) { next(err); }
};

/**
 * Busca o histórico de notas de um aluno em uma disciplina
 */
exports.getStudentSubjectHistory = async (req, res, next) => {
	try {
		const { studentId, subjectId, academicYearId } = req.params;

		// Verificar permissões (implementação depende da lógica de autenticação)
		// ...

		// Buscar todas as notas do aluno nesta disciplina
		const marks = await Marks.find({
			student: studentId,
			subject: subjectId,
			academicYear: academicYearId
		}).sort({ date: 1 });

		// Buscar informações da disciplina
		const subject = await Subject.findById(subjectId);
		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		// Buscar informações do aluno
		const student = await Student.findById(studentId);
		if (!student) {
			return res.status(404).json(createErrorResponse('Student not found'));
		}

		// Calcular média atual
		let average = 0;
		if (marks.length > 0) {
			let totalWeight = 0;
			let weightedSum = 0;

			marks.forEach(mark => {
				weightedSum += mark.grade * mark.weight;
				totalWeight += mark.weight;
			});

			average = totalWeight > 0 ? weightedSum / totalWeight : 0;
		}

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
				comments: mark.comments,
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

		return res.status(200).json({
			success: true,
			data: {
				student: {
					_id: student._id,
					name: student.name,
					admissionNumber: student.admissionNumber
				},
				subject: {
					_id: subject._id,
					name: subject.name,
					code: subject.code,
					type: subject.type,
					minGradeToPass: subject.minGradeToPass
				},
				academicYear: academicYearId,
				average: parseFloat(average.toFixed(2)),
				approved: average >= subject.minGradeToPass && marks.length > 0,
				totalMarks: marks.length,
				periodAverages,
				marksByPeriod
			}
		});
	} catch (err) { next(err); }
};

/**
 * Busca alunos em risco de reprovação
 */
exports.getRiskStudents = async (req, res, next) => {
	try {
		const { classId, academicYearId, threshold = 2 } = req.params;

		// Verificar permissões (implementação depende da lógica de autenticação)
		// ...

		// Buscar todos os alunos da turma
		const Enrollment = mongoose.model('Enrollment');
		const enrollments = await Enrollment.find({
			class: classId,
			academicYear: academicYearId,
			status: 'active'
		}).populate('student', 'name admissionNumber');

		// Buscar todas as disciplinas da turma
		const subjects = await Subject.find({
			classes: classId,
			academicYear: academicYearId
		});

		// Para cada aluno, verificar em quantas disciplinas está em risco
		const studentsAtRisk = await Promise.all(
			enrollments.map(async (enrollment) => {
				const failedSubjects = [];

				// Verificar cada disciplina
				for (const subject of subjects) {
					const result = await AcademicEvaluationService.calculateSubjectFinalGrade(
						enrollment.student._id,
						subject._id,
						academicYearId
					);

					if (!result.approved) {
						failedSubjects.push({
							_id: subject._id,
							name: subject.name,
							code: subject.code,
							average: result.average,
							minGradeToPass: result.minGradeToPass
						});
					}
				}

				// Se o número de disciplinas em risco for maior ou igual ao threshold
				if (failedSubjects.length >= threshold) {
					return {
						student: {
							_id: enrollment.student._id,
							name: enrollment.student.name,
							admissionNumber: enrollment.student.admissionNumber
						},
						failedSubjects,
						totalFailedSubjects: failedSubjects.length,
						totalSubjects: subjects.length,
						failureRate: parseFloat(((failedSubjects.length / subjects.length) * 100).toFixed(2))
					};
				}

				return null;
			})
		);

		// Filtrar alunos que não estão em risco
		const filteredStudents = studentsAtRisk.filter(student => student !== null);

		// Ordenar por número de disciplinas em risco (decrescente)
		filteredStudents.sort((a, b) => b.totalFailedSubjects - a.totalFailedSubjects);

		return res.status(200).json({
			success: true,
			data: {
				class: classId,
				academicYear: academicYearId,
				threshold,
				totalStudents: enrollments.length,
				studentsAtRisk: filteredStudents.length,
				atRiskPercentage: enrollments.length > 0
					? parseFloat(((filteredStudents.length / enrollments.length) * 100).toFixed(2))
					: 0,
				students: filteredStudents
			}
		});
	} catch (err) { next(err); }
};

module.exports = exports;