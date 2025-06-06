// Subjects Controller (Corrigido)
// ./api/subjects/subjects.controller.js

const Subjects = require('./subjects.model');
const Classes = require('../classes/classes.model');
const Marks = require('../marks/marks.model');
const { createErrorResponse } = require('../../helpers');

/**
 * Lista disciplinas com filtros e paginação
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
		const filter = { school: schoolId };

		// Filtros diretos
		if (req.query.status) filter.status = req.query.status;
		if (req.query.type) filter.type = req.query.type;
		if (req.query.search) filter.name = new RegExp(req.query.search, 'i');
		if (req.query.employeeId) filter.employees = req.query.employeeId;

		// Filtro por classe
		if (req.query.classId) {
			// Buscar a classe para verificar se a disciplina está associada
			const classObj = await Classes.findById(req.query.classId);
			if (classObj && classObj.subjects && classObj.subjects.length > 0) {
				filter._id = { $in: classObj.subjects };
			} else {
				// Se a classe não tem disciplinas, retornar vazio
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

		// Filtros por academicYear e yearLevel (indiretos via Classes)
		if (req.query.academicYear || req.query.yearLevel) {
			const classFilter = { school: schoolId };
			if (req.query.academicYear) classFilter.academicYear = req.query.academicYear;
			if (req.query.yearLevel) classFilter.yearLevel = req.query.yearLevel;

			const classes = await Classes.find(classFilter);

			if (classes.length > 0) {
				// Extrair todas as disciplinas associadas a estas classes
				const subjectIds = new Set();
				classes.forEach(cls => {
					if (cls.subjects && cls.subjects.length > 0) {
						cls.subjects.forEach(subjectId => subjectIds.add(subjectId.toString()));
					}
				});

				if (subjectIds.size > 0) {
					// Se já temos um filtro de ID, fazemos a interseção
					if (filter._id && filter._id.$in) {
						const currentIds = new Set(filter._id.$in.map(id => id.toString()));
						const intersection = [...subjectIds].filter(id => currentIds.has(id));

						if (intersection.length === 0) {
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

						filter._id.$in = intersection.map(id => id);
					} else {
						filter._id = { $in: [...subjectIds] };
					}
				} else {
					// Se as classes não têm disciplinas, retornar vazio
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
			} else {
				// Se não encontrar classes com o filtro, retornar vazio
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

		const [totalCount, subjects] = await Promise.all([
			Subjects.countDocuments(filter),
			Subjects.find(filter)
				.populate('employees', 'firstName lastName email')
				.populate('prerequisites.subject', 'name code')
				.sort({ [sortBy]: order })
				.skip(skip)
				.limit(limit)
		]);

		// Para cada disciplina, buscar as classes associadas
		const populatedSubjects = await Promise.all(
			subjects.map(async (subject) => {
				const classes = await Classes.find({
					subjects: subject._id,
					school: schoolId
				})
					.select('name yearLevel academicYear')
					.populate('yearLevel', 'name order')
					.populate('academicYear', 'name startDate endDate');

				const subjectObj = subject.toObject();
				subjectObj.classes = classes;
				return subjectObj;
			})
		);

		const totalPages = Math.ceil(totalCount / limit);

		res.status(200).json({
			success: true,
			data: {
				subjects: populatedSubjects,
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
			.populate('employees', 'firstName lastName email')
			.populate('prerequisites.subject', 'name code');

		if (!subject) return res.status(404).json(createErrorResponse('Subject not found'));

		// Buscar classes associadas a esta disciplina
		const classes = await Classes.find({
			subjects: subject._id,
			school: req.user.school
		})
			.select('name yearLevel academicYear')
			.populate('yearLevel', 'name order')
			.populate('academicYear', 'name startDate endDate');

		const subjectObj = subject.toObject();
		subjectObj.classes = classes;

		res.json({ success: true, data: subjectObj });
	} catch (err) { next(err); }
};

/**
 * Cria uma nova disciplina
 */
exports.createSubject = async (req, res, next) => {
	try {
		const {
			name,
			code,
			type,
			employees,
			description,
			workload,
			credits,
			minGradeToPass,
			prerequisites,
			status,
			classes
		} = req.body;

		// Validações básicas
		if (!name || !type) {
			return res.status(400).json(createErrorResponse('Name and type are required'));
		}

		// Verificar se já existe uma disciplina com o mesmo nome e código
		const existingSubject = await Subjects.findOne({
			name,
			school: req.user.school,
			...(code && { code })
		});

		if (existingSubject) {
			return res.status(400).json(createErrorResponse('Subject with this name already exists'));
		}

		// Criar a disciplina
		const subject = await Subjects.create({
			school: req.user.school,
			name,
			code,
			type,
			employees,
			description,
			workload,
			credits,
			minGradeToPass: minGradeToPass || 6.0,
			prerequisites,
			status: status || 'active'
		});

		// Se foram fornecidas classes, associar a disciplina a elas
		if (classes && classes.length > 0) {
			await Promise.all(
				classes.map(classId =>
					Classes.findByIdAndUpdate(
						classId,
						{ $addToSet: { subjects: subject._id } }
					)
				)
			);
		}

		// Buscar a disciplina com dados populados
		const populatedSubject = await Subjects.findById(subject._id)
			.populate('employees', 'firstName lastName email')
			.populate('prerequisites.subject', 'name code');

		// Buscar classes associadas
		const associatedClasses = await Classes.find({
			subjects: subject._id,
			school: req.user.school
		})
			.select('name yearLevel academicYear')
			.populate('yearLevel', 'name order')
			.populate('academicYear', 'name startDate endDate');

		const subjectObj = populatedSubject.toObject();
		subjectObj.classes = associatedClasses;

		res.status(201).json({
			success: true,
			data: subjectObj
		});
	} catch (err) { next(err); }
};

/**
 * Atualiza uma disciplina existente
 */
exports.updateSubject = async (req, res, next) => {
	try {
		const { id } = req.params;
		const {
			name,
			code,
			type,
			employees,
			description,
			workload,
			credits,
			minGradeToPass,
			prerequisites,
			status,
			classes
		} = req.body;

		// Verificar se a disciplina existe
		const subject = await Subjects.findOne({
			_id: id,
			school: req.user.school
		});

		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		// Verificar se já existe outra disciplina com o mesmo nome e código
		if (name && name !== subject.name) {
			const existingSubject = await Subjects.findOne({
				name,
				school: req.user.school,
				_id: { $ne: id }
			});

			if (existingSubject) {
				return res.status(400).json(createErrorResponse('Another subject with this name already exists'));
			}
		}

		// Atualizar campos permitidos
		const updates = {};
		if (name !== undefined) updates.name = name;
		if (code !== undefined) updates.code = code;
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
			.populate('employees', 'firstName lastName email')
			.populate('prerequisites.subject', 'name code');

		// Atualizar associações com classes
		if (classes !== undefined) {
			// Primeiro, remover a disciplina de todas as classes que a têm
			await Classes.updateMany(
				{ subjects: id },
				{ $pull: { subjects: id } }
			);

			// Depois, adicionar a disciplina às classes fornecidas
			if (classes.length > 0) {
				await Promise.all(
					classes.map(classId =>
						Classes.findByIdAndUpdate(
							classId,
							{ $addToSet: { subjects: id } }
						)
					)
				);
			}
		}

		// Buscar classes associadas
		const associatedClasses = await Classes.find({
			subjects: id,
			school: req.user.school
		})
			.select('name yearLevel academicYear')
			.populate('yearLevel', 'name order')
			.populate('academicYear', 'name startDate endDate');

		const subjectObj = updatedSubject.toObject();
		subjectObj.classes = associatedClasses;

		res.json({
			success: true,
			data: subjectObj,
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

		// Verificar se existem notas associadas a esta disciplina
		const hasMarks = await Marks.exists({
			subject: id
		});

		if (hasMarks) {
			return res.status(400).json(createErrorResponse(
				'Cannot delete subject with associated marks. Change status to inactive or archived instead.'
			));
		}

		// Verificar se a disciplina é pré-requisito para outras
		const isPrerequisite = await Subjects.exists({
			'prerequisites.subject': id
		});

		if (isPrerequisite) {
			return res.status(400).json(createErrorResponse(
				'Cannot delete subject that is a prerequisite for other subjects. Change status to inactive or archived instead.'
			));
		}

		// Remover a disciplina de todas as classes que a têm
		await Classes.updateMany(
			{ subjects: id },
			{ $pull: { subjects: id } }
		);

		// Excluir a disciplina
		await Subjects.findByIdAndDelete(id);

		res.json({
			success: true,
			message: 'Subject deleted successfully'
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
		)
			.populate('employees', 'firstName lastName email')
			.populate('prerequisites.subject', 'name code');

		// Buscar classes associadas
		const associatedClasses = await Classes.find({
			subjects: id,
			school: req.user.school
		})
			.select('name yearLevel academicYear')
			.populate('yearLevel', 'name order')
			.populate('academicYear', 'name startDate endDate');

		const subjectObj = updatedSubject.toObject();
		subjectObj.classes = associatedClasses;

		res.json({
			success: true,
			data: subjectObj,
			message: 'Subject status updated successfully'
		});
	} catch (err) { next(err); }
};

/**
 * Verifica pré-requisitos para um aluno
 */
exports.checkPrerequisites = async (req, res, next) => {
	try {
		const { subjectId, studentId } = req.params;

		// Verificar se a disciplina existe
		const subject = await Subjects.findOne({
			_id: subjectId,
			school: req.user.school
		}).populate('prerequisites.subject', 'name');

		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		// Se não tem pré-requisitos, retornar elegível
		if (!subject.prerequisites || subject.prerequisites.length === 0) {
			return res.json({
				success: true,
				data: {
					eligible: true,
					results: [],
					message: 'No prerequisites required'
				}
			});
		}

		// Verificar cada pré-requisito
		const prerequisiteChecks = await Promise.all(
			subject.prerequisites.map(async (prereq) => {
				const prereqSubject = prereq.subject;
				const minGrade = prereq.minGrade;

				// Buscar notas do aluno para esta disciplina
				const marks = await Marks.find({
					student: studentId,
					subject: prereqSubject._id
				}).populate('class', 'name');

				if (!marks || marks.length === 0) {
					return {
						subject: prereqSubject.name,
						required: minGrade,
						obtained: 'N/A',
						passed: false
					};
				}

				// Calcular a média mais alta entre todas as tentativas
				let highestAverage = 0;
				let classInfo = '';

				for (const mark of marks) {
					const result = await Marks.calculateAverage(
						studentId,
						prereqSubject._id,
						mark.class._id
					);

					if (result.average > highestAverage) {
						highestAverage = result.average;
						classInfo = mark.class.name;
					}
				}

				return {
					subject: prereqSubject.name,
					required: minGrade,
					obtained: highestAverage,
					class: classInfo,
					passed: highestAverage >= minGrade
				};
			})
		);

		// Verificar se todos os pré-requisitos são atendidos
		const allPrerequisitesMet = prerequisiteChecks.every(check => check.passed);

		res.json({
			success: true,
			data: {
				eligible: allPrerequisitesMet,
				results: prerequisiteChecks,
				message: allPrerequisitesMet
					? 'All prerequisites met'
					: 'Some prerequisites not met'
			}
		});
	} catch (err) { next(err); }
};

/**
 * Verifica aprovação de um aluno em uma disciplina
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

		// Verificar aprovação
		const result = await Marks.checkApproval(studentId, subjectId, classId);

		res.json({
			success: true,
			data: result
		});
	} catch (err) { next(err); }
};

/**
 * Busca estatísticas de aprovação por disciplina
 */
exports.getApprovalStats = async (req, res, next) => {
	try {
		const { subjectId } = req.params;
		const { classId, academicYearId } = req.query;

		// Verificar se a disciplina existe
		const subject = await Subjects.findOne({
			_id: subjectId,
			school: req.user.school
		});

		if (!subject) {
			return res.status(404).json(createErrorResponse('Subject not found'));
		}

		// Filtro para buscar classes
		const classFilter = {
			subjects: subjectId,
			school: req.user.school
		};

		if (classId) {
			classFilter._id = classId;
		} else if (academicYearId) {
			classFilter.academicYear = academicYearId;
		}

		// Buscar classes que têm esta disciplina
		const classes = await Classes.find(classFilter);

		if (!classes || classes.length === 0) {
			return res.json({
				success: true,
				data: {
					subject: subject.name,
					totalStudents: 0,
					approvedStudents: 0,
					approvalRate: 0,
					details: []
				}
			});
		}

		// Buscar matrículas para estas classes
		const Enrollment = require('../enrollment/enrollment.model');
		const enrollments = await Enrollment.find({
			class: { $in: classes.map(c => c._id) }
		}).populate('student', 'firstName lastName');

		if (!enrollments || enrollments.length === 0) {
			return res.json({
				success: true,
				data: {
					subject: subject.name,
					totalStudents: 0,
					approvedStudents: 0,
					approvalRate: 0,
					details: []
				}
			});
		}

		// Verificar aprovação para cada aluno
		const approvalDetails = await Promise.all(
			enrollments.map(async (enrollment) => {
				try {
					const result = await Marks.checkApproval(
						enrollment.student._id,
						subjectId,
						enrollment.class
					);

					return {
						student: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
						class: classes.find(c => c._id.toString() === enrollment.class.toString())?.name || 'Unknown',
						approved: result.approved,
						average: result.average
					};
				} catch (error) {
					return {
						student: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
						class: classes.find(c => c._id.toString() === enrollment.class.toString())?.name || 'Unknown',
						approved: false,
						average: 0,
						error: 'No marks found'
					};
				}
			})
		);

		// Calcular estatísticas
		const totalStudents = approvalDetails.length;
		const approvedStudents = approvalDetails.filter(d => d.approved).length;
		const approvalRate = totalStudents > 0
			? (approvedStudents / totalStudents) * 100
			: 0;

		res.json({
			success: true,
			data: {
				subject: subject.name,
				totalStudents,
				approvedStudents,
				approvalRate: parseFloat(approvalRate.toFixed(2)),
				details: approvalDetails
			}
		});
	} catch (err) { next(err); }
};

/**
 * Busca disciplinas por tipo para um determinado nível e ano acadêmico
 */
exports.findByTypeAndLevel = async (req, res, next) => {
	try {
		const { yearLevelId, academicYearId, type } = req.params;

		// Validar tipo
		if (!['mandatory', 'complementary', 'elective'].includes(type)) {
			return res.status(400).json(createErrorResponse(
				'Invalid type. Must be one of: mandatory, complementary, elective'
			));
		}

		// Buscar classes com este nível e ano acadêmico
		const classes = await Classes.find({
			yearLevel: yearLevelId,
			academicYear: academicYearId,
			school: req.user.school
		});

		if (!classes || classes.length === 0) {
			return res.json({
				success: true,
				data: []
			});
		}

		// Extrair IDs de disciplinas de todas as classes
		const subjectIds = new Set();
		classes.forEach(cls => {
			if (cls.subjects && cls.subjects.length > 0) {
				cls.subjects.forEach(subjectId => subjectIds.add(subjectId.toString()));
			}
		});

		if (subjectIds.size === 0) {
			return res.json({
				success: true,
				data: []
			});
		}

		// Buscar disciplinas do tipo especificado
		const subjects = await Subjects.find({
			_id: { $in: [...subjectIds] },
			type,
			school: req.user.school
		})
			.populate('employees', 'firstName lastName email')
			.populate('prerequisites.subject', 'name code');

		// Para cada disciplina, buscar as classes associadas
		const populatedSubjects = await Promise.all(
			subjects.map(async (subject) => {
				const associatedClasses = classes.filter(cls =>
					cls.subjects && cls.subjects.some(s => s.toString() === subject._id.toString())
				);

				const subjectObj = subject.toObject();
				subjectObj.classes = associatedClasses.map(cls => ({
					_id: cls._id,
					name: cls.name,
					yearLevel: cls.yearLevel,
					academicYear: cls.academicYear
				}));

				return subjectObj;
			})
		);

		res.json({
			success: true,
			data: populatedSubjects
		});
	} catch (err) { next(err); }
};
