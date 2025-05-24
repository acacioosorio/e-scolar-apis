// Subjects Controller
// ./api/subjects/subjects.controller.js

const Subjects = require('./subjects.model');
const Classes = require('../classes/classes.model');
const Marks = require('../marks/marks.model');
const Enrollment = require('../enrollment/enrollment.model');
const YearLevel = require('../pedagogy/yearLevel.model');
const { createErrorResponse } = require('../../helpers');

/**
 * Lista disciplinas com filtros, busca e paginação
 */
exports.listSubjects = async (req, res, next) => {
	try {
		const schoolId = req.query.schoolId || req.user?.school;

		const {
			page = parseInt(req.query.page) || 1,
			limit = parseInt(req.query.limit) || 10,
			sortBy = 'name',
			order = req.query.order === 'desc' ? -1 : 1
		} = req.query;

		const skip = (page - 1) * limit;

		if (!schoolId) {
			return res.status(400).json(createErrorResponse('School ID is required'));
		}

		const filter = { school: schoolId };

		// Filtros diretos
		if (req.query.status) filter.status = req.query.status;
		if (req.query.type) filter.type = req.query.type;
		if (req.query.classId) filter.classes = req.query.classId;
		if (req.query.employeeId) filter.employees = req.query.employeeId;

		// Filtros indiretos via classes
		let classFilter = {};
		if (req.query.academicYear) classFilter.academicYear = req.query.academicYear;
		if (req.query.yearLevel) classFilter.yearLevel = req.query.yearLevel;

		// Se temos filtros de classe, primeiro buscamos as classes
		if (Object.keys(classFilter).length > 0) {
			const classes = await Classes.find({
				...classFilter,
				school: schoolId
			});

			if (classes.length > 0) {
				filter.classes = { $in: classes.map(c => c._id) };
			} else {
				// Se não encontrar classes com os filtros, retornar vazio
				return res.status(200).json({
					success: true,
					data: {
						subjects: [],
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

		// Busca por nome, código ou descrição
		if (req.query.search) {
			const searchRegex = new RegExp(req.query.search, 'i');
			filter.$or = [
				{ name: searchRegex },
				{ code: searchRegex },
				{ description: searchRegex }
			];
		}

		const [totalCount, subjects] = await Promise.all([
			Subjects.countDocuments(filter),
			Subjects.find(filter)
				.populate({
					path: 'classes',
					select: 'name yearLevel academicYear',
					populate: [
						{ path: 'yearLevel', select: 'name order' },
						{ path: 'academicYear', select: 'name startDate endDate' }
					]
				})
				.populate('employees', 'firstName lastName email')
				.sort({ [sortBy]: order })
				.skip(skip)
				.limit(limit)
		]);

		const totalPages = Math.ceil(totalCount / limit);

		res.status(200).json({
			success: true,
			data: {
				subjects,
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
 * Obtém detalhes de uma disciplina específica
 */
exports.getSubject = async (req, res, next) => {
	try {
		const subject = await Subjects.findOne({
			_id: req.params.id,
			school: req.user.school
		})
			.populate({
				path: 'classes',
				select: 'name yearLevel academicYear',
				populate: [
					{ path: 'yearLevel', select: 'name order' },
					{ path: 'academicYear', select: 'name startDate endDate' }
				]
			})
			.populate('employees', 'firstName lastName email')
			.populate({
				path: 'prerequisites.subject',
				select: 'name code'
			});

		if (!subject) return res.status(404).json(createErrorResponse('Subject not found'));

		res.json({ success: true, data: subject });
	} catch (err) { next(err); }
};

/**
 * Cria uma nova disciplina
 */
exports.createSubject = async (req, res, next) => {
	try {
		const {
			name, code, classes, type,
			employees, description, workload, credits, minGradeToPass,
			prerequisites
		} = req.body;

		// Validações básicas
		if (!name || !classes || !classes.length || !type) {
			return res.status(400).json(createErrorResponse('Name, classes and type are required'));
		}

		// Verificar se as classes existem
		const classesExist = await Classes.find({
			_id: { $in: classes },
			school: req.user.school
		});

		if (classesExist.length !== classes.length) {
			return res.status(400).json(createErrorResponse('One or more classes not found'));
		}

		// Verificar se já existe uma disciplina com o mesmo código nas mesmas classes
		if (code) {
			const existingSubject = await Subjects.findOne({
				school: req.user.school,
				classes: { $in: classes },
				code
			});

			if (existingSubject) {
				return res.status(400).json(createErrorResponse('A subject with this code already exists for these classes'));
			}
		}

		// Verificar pré-requisitos circulares
		if (prerequisites && prerequisites.length > 0) {
			for (const prereq of prerequisites) {
				if (!prereq.subject) {
					return res.status(400).json(createErrorResponse('Prerequisite subject ID is required'));
				}

				// Verificar se o pré-requisito existe
				const prerequisiteSubject = await Subjects.findOne({
					_id: prereq.subject,
					school: req.user.school
				});

				if (!prerequisiteSubject) {
					return res.status(400).json(createErrorResponse(`Prerequisite subject with ID ${prereq.subject} not found`));
				}

				// Verificar se o pré-requisito não é a própria disciplina
				if (prerequisiteSubject._id.toString() === req.params.id) {
					return res.status(400).json(createErrorResponse('A subject cannot be a prerequisite of itself'));
				}

				// Verificar dependência circular
				const hasCircularDependency = await checkCircularDependency(
					prereq.subject,
					req.params.id,
					new Set()
				);

				if (hasCircularDependency) {
					return res.status(400).json(createErrorResponse('Circular dependency detected in prerequisites'));
				}
			}
		}

		// Criar a disciplina
		const subject = await Subjects.create({
			school: req.user.school,
			name,
			code,
			classes,
			type,
			employees: employees || [],
			status: 'active',
			description,
			workload: workload || 0,
			credits: credits || 0,
			minGradeToPass: minGradeToPass || 6.0,
			prerequisites: prerequisites || []
		});

		// Retornar com dados populados
		const populatedSubject = await Subjects.findById(subject._id)
			.populate({
				path: 'classes',
				select: 'name yearLevel academicYear',
				populate: [
					{ path: 'yearLevel', select: 'name order' },
					{ path: 'academicYear', select: 'name startDate endDate' }
				]
			})
			.populate('employees', 'firstName lastName email')
			.populate({
				path: 'prerequisites.subject',
				select: 'name code'
			});

		res.status(201).json({
			success: true,
			data: populatedSubject,
			message: 'Subject created successfully'
		});
	} catch (err) {
		if (err.code === 11000) {
			return res.status(400).json(createErrorResponse('Duplicate subject. A subject with this combination already exists.'));
		}
		next(err);
	}
};

/**
 * Atualiza uma disciplina existente
 */
exports.updateSubject = async (req, res, next) => {
	try {
		const { id } = req.params;
		const {
			name, code, classes, type, employees, description,
			workload, credits, minGradeToPass, prerequisites, status
		} = req.body;

		// Verificar se a disciplina existe
		const subject = await Subjects.findOne({
			_id: id,
			school: req.user.school
		});

		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		// Validar status
		if (status && !['active', 'inactive', 'archived'].includes(status)) {
			return res.status(400).json(createErrorResponse(
				'Invalid status. Must be one of: active, inactive, archived'
			));
		}

		// Verificar pré-requisitos circulares
		if (prerequisites && prerequisites.length > 0) {
			for (const prereq of prerequisites) {
				if (!prereq.subject) {
					return res.status(400).json(createErrorResponse('Prerequisite subject ID is required'));
				}

				// Verificar se o pré-requisito existe
				const prerequisiteSubject = await Subjects.findOne({
					_id: prereq.subject,
					school: req.user.school
				});

				if (!prerequisiteSubject) {
					return res.status(400).json(createErrorResponse(`Prerequisite subject with ID ${prereq.subject} not found`));
				}

				// Verificar se o pré-requisito não é a própria disciplina
				if (prerequisiteSubject._id.toString() === id) {
					return res.status(400).json(createErrorResponse('A subject cannot be a prerequisite of itself'));
				}

				// Verificar dependência circular
				const hasCircularDependency = await checkCircularDependency(
					prereq.subject,
					id,
					new Set()
				);

				if (hasCircularDependency) {
					return res.status(400).json(createErrorResponse('Circular dependency detected in prerequisites'));
				}
			}
		}

		// Atualizar campos permitidos
		const updates = {};
		if (name !== undefined) updates.name = name;
		if (code !== undefined) updates.code = code;
		if (classes !== undefined) updates.classes = classes;
		if (type !== undefined) updates.type = type;
		if (employees !== undefined) updates.employees = employees;
		if (description !== undefined) updates.description = description;
		if (workload !== undefined) updates.workload = workload;
		if (credits !== undefined) updates.credits = credits;
		if (minGradeToPass !== undefined) updates.minGradeToPass = minGradeToPass;
		if (prerequisites !== undefined) updates.prerequisites = prerequisites;
		if (status !== undefined) updates.status = status;

		// Atualizar a disciplina
		const updatedSubject = await Subjects.findByIdAndUpdate(
			id,
			{ $set: updates },
			{ new: true }
		)
			.populate({
				path: 'classes',
				select: 'name yearLevel academicYear',
				populate: [
					{ path: 'yearLevel', select: 'name order' },
					{ path: 'academicYear', select: 'name startDate endDate' }
				]
			})
			.populate('employees', 'firstName lastName email')
			.populate({
				path: 'prerequisites.subject',
				select: 'name code'
			});

		res.json({
			success: true,
			data: updatedSubject,
			message: 'Subject updated successfully'
		});
	} catch (err) { next(err); }
};

/**
 * Exclui uma disciplina
 */
exports.deleteSubject = async (req, res, next) => {
	try {
		const { id } = req.params;

		// Verificar se a disciplina existe
		const subject = await Subjects.findOne({
			_id: id,
			school: req.user.school
		});

		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		// Verificar se existem notas ou outros registros dependentes
		const hasMarks = await Marks.exists({ subject: id });
		if (hasMarks) {
			return res.status(400).json(createErrorResponse(
				'Cannot delete subject with associated marks. Archive it instead.'
			));
		}

		// Verificar se é pré-requisito de outras disciplinas
		const isPrerequisite = await Subjects.exists({
			'prerequisites.subject': id
		});

		if (isPrerequisite) {
			return res.status(400).json(createErrorResponse(
				'Cannot delete subject that is a prerequisite for other subjects. Archive it instead.'
			));
		}

		// Excluir a disciplina
		await Subjects.findByIdAndDelete(id);

		res.json({
			success: true,
			message: 'Subject deleted successfully'
		});
	} catch (err) { next(err); }
};

/**
 * Verifica se um aluno atende aos pré-requisitos para uma disciplina
 */
exports.checkPrerequisites = async (req, res, next) => {
	try {
		const { subjectId, studentId } = req.params;

		// Verificar se a disciplina existe
		const subject = await Subjects.findOne({
			_id: subjectId,
			school: req.user.school
		}).populate('prerequisites.subject');

		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		// Se não há pré-requisitos, o aluno é elegível
		if (!subject.prerequisites || subject.prerequisites.length === 0) {
			return res.json({
				success: true,
				data: { eligible: true, results: [] }
			});
		}

		const results = [];

		// Verificar cada pré-requisito
		for (const prereq of subject.prerequisites) {
			// Buscar a classe atual do aluno para obter o academicYear
			const enrollment = await Enrollment.findOne({
				student: studentId,
				status: 'studying'
			}).populate('class');

			if (!enrollment) {
				return res.status(404).json(createErrorResponse('Student enrollment not found'));
			}

			// Buscar matrículas anteriores do aluno (aprovadas)
			const previousEnrollments = await Enrollment.find({
				student: studentId,
				status: 'approved'
			}).populate({
				path: 'class',
				populate: {
					path: 'academicYear'
				}
			});

			// Buscar a nota mais recente do aluno neste pré-requisito
			// em qualquer matrícula anterior
			let mark = null;

			for (const prevEnrollment of previousEnrollments) {
				// Buscar disciplinas da classe anterior
				const classSubjects = await Subjects.find({
					classes: prevEnrollment.class._id
				});

				// Verificar se o pré-requisito estava nesta classe
				const subjectInClass = classSubjects.find(s =>
					s._id.toString() === prereq.subject._id.toString());

				if (subjectInClass) {
					// Buscar a nota para esta disciplina nesta classe
					const foundMark = await Marks.findOne({
						student: studentId,
						subject: prereq.subject._id,
						class: prevEnrollment.class._id
					}).sort({ date: -1 });

					if (foundMark) {
						mark = foundMark;
						break; // Encontramos a nota mais recente
					}
				}
			}

			if (!mark || mark.grade < prereq.minGrade) {
				results.push({
					subject: prereq.subject.name,
					required: prereq.minGrade,
					obtained: mark ? mark.grade : 'Não cursada',
					passed: false
				});
			} else {
				results.push({
					subject: prereq.subject.name,
					required: prereq.minGrade,
					obtained: mark.grade,
					passed: true
				});
			}
		}

		const eligible = results.every(r => r.passed);

		res.json({
			success: true,
			data: {
				eligible,
				results
			}
		});
	} catch (err) { next(err); }
};

/**
 * Verifica se um aluno foi aprovado em uma disciplina
 */
exports.checkApproval = async (req, res, next) => {
	try {
		const { subjectId, studentId, classId } = req.params;

		// Verificar se a disciplina existe
		const subject = await Subjects.findOne({
			_id: subjectId,
			school: req.user.school
		});

		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		// Verificar se a classe existe
		const classObj = await Classes.findOne({
			_id: classId,
			school: req.user.school
		});

		if (!classObj) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		// Buscar todas as notas do aluno nesta disciplina e classe
		const marks = await Marks.find({
			student: studentId,
			subject: subjectId,
			class: classId
		});

		if (!marks.length) {
			return res.json({
				success: true,
				data: {
					approved: false,
					reason: 'Sem notas registradas',
					average: 0,
					minRequired: subject.minGradeToPass
				}
			});
		}

		// Calcular média ponderada
		let totalWeight = 0;
		let weightedSum = 0;

		marks.forEach(mark => {
			weightedSum += mark.grade * mark.weight;
			totalWeight += mark.weight;
		});

		const average = totalWeight > 0 ? weightedSum / totalWeight : 0;

		res.json({
			success: true,
			data: {
				approved: average >= subject.minGradeToPass,
				average: parseFloat(average.toFixed(2)),
				minRequired: subject.minGradeToPass
			}
		});
	} catch (err) { next(err); }
};

/**
 * Busca todas as disciplinas por tipo para um determinado nível e ano acadêmico
 */
exports.findByTypeAndLevel = async (req, res, next) => {
	try {
		const { yearLevelId, academicYearId, type } = req.params;
		const schoolId = req.user.school;

		// Validar tipo
		if (!['mandatory', 'complementary', 'elective'].includes(type)) {
			return res.status(400).json(createErrorResponse(
				'Invalid type. Must be one of: mandatory, complementary, elective'
			));
		}

		// Primeiro, encontrar classes com este yearLevel e academicYear
		const classes = await Classes.find({
			school: schoolId,
			yearLevel: yearLevelId,
			academicYear: academicYearId
		});

		if (!classes.length) {
			return res.json({
				success: true,
				data: []
			});
		}

		// Depois, buscar disciplinas associadas a estas classes
		const subjects = await Subjects.find({
			school: schoolId,
			classes: { $in: classes.map(c => c._id) },
			type: type
		}).populate('employees', 'firstName lastName email');

		res.json({
			success: true,
			data: subjects
		});
	} catch (err) { next(err); }
};

/**
 * Busca estatísticas de aprovação por disciplina
 */
exports.getApprovalStats = async (req, res, next) => {
	try {
		const { subjectId } = req.params;

		// Verificar se a disciplina existe
		const subject = await Subjects.findOne({
			_id: subjectId,
			school: req.user.school
		});

		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		// Buscar todas as matrículas que incluem esta disciplina
		const enrollments = await Enrollment.find({
			class: { $in: subject.classes }
		});

		const studentIds = enrollments.map(e => e.student);

		// Para cada aluno, verificar aprovação
		const results = [];
		for (const studentId of studentIds) {
			// Para cada classe onde o aluno está matriculado
			for (const enrollment of enrollments.filter(e => e.student.toString() === studentId.toString())) {
				// Buscar todas as notas do aluno nesta disciplina e classe
				const marks = await Marks.find({
					student: studentId,
					subject: subjectId,
					class: enrollment.class
				});

				if (marks.length > 0) {
					// Calcular média
					const sum = marks.reduce((acc, mark) => acc + mark.grade * mark.weight, 0);
					const totalWeight = marks.reduce((acc, mark) => acc + mark.weight, 0);
					const average = totalWeight > 0 ? sum / totalWeight : 0;
					const approved = average >= subject.minGradeToPass;

					results.push({
						student: studentId,
						class: enrollment.class,
						approved,
						average: parseFloat(average.toFixed(2))
					});
				}
			}
		}

		// Calcular estatísticas
		const totalStudents = results.length;
		const approvedStudents = results.filter(r => r.approved).length;
		const approvalRate = totalStudents > 0 ? (approvedStudents / totalStudents) * 100 : 0;

		res.json({
			success: true,
			data: {
				subject: subject.name,
				totalStudents,
				approvedStudents,
				approvalRate: parseFloat(approvalRate.toFixed(2)),
				details: results
			}
		});
	} catch (err) { next(err); }
};

/**
 * Atualiza o status de uma disciplina
 */
exports.updateStatus = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { status } = req.body;

		// Validar status
		if (!['active', 'inactive', 'archived'].includes(status)) {
			return res.status(400).json(createErrorResponse(
				'Invalid status. Must be one of: active, inactive, archived'
			));
		}

		// Verificar se a disciplina existe
		const subject = await Subjects.findOne({
			_id: id,
			school: req.user.school
		});

		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		// Atualizar status
		const updatedSubject = await Subjects.findByIdAndUpdate(
			id,
			{ $set: { status } },
			{ new: true }
		);

		res.json({
			success: true,
			data: updatedSubject,
			message: 'Subject status updated successfully'
		});
	} catch (err) { next(err); }
};

/**
 * Função auxiliar para verificar dependências circulares entre disciplinas
 * @param {string} currentSubjectId - ID da disciplina atual
 * @param {string} targetSubjectId - ID da disciplina alvo
 * @param {Set<string>} visited - Conjunto de IDs de disciplinas já visitadas
 * @returns {Promise<boolean>} - True se houver dependência circular, False caso contrário
 */
async function checkCircularDependency(currentSubjectId, targetSubjectId, visited) {
	// Se já visitamos esta disciplina, evitar loop infinito
	if (visited.has(currentSubjectId)) {
		return false;
	}

	// Marcar como visitada
	visited.add(currentSubjectId);

	// Verificar se a disciplina atual tem o alvo como pré-requisito
	if (currentSubjectId === targetSubjectId) {
		return true;
	}

	// Buscar a disciplina atual
	const subject = await Subjects.findById(currentSubjectId);
	if (!subject || !subject.prerequisites || subject.prerequisites.length === 0) {
		return false;
	}

	// Verificar recursivamente os pré-requisitos
	for (const prereq of subject.prerequisites) {
		const hasCircular = await checkCircularDependency(
			prereq.subject.toString(),
			targetSubjectId,
			new Set(visited)
		);

		if (hasCircular) {
			return true;
		}
	}

	return false;
}