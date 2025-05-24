// Enrollment Controller
// ./api/enrollment/enrollment.controller.js

const Enrollment = require('./enrollment.model');
const Classes = require('../classes/classes.model');
const Student = require('../students/students.model');
const Subjects = require('../subjects/subjects.model');
const YearLevel = require('../pedagogy/yearLevel.model');
const Marks = require('../marks/marks.model');
const { createErrorResponse } = require('../../helpers');

/**
 * Lista matrículas com filtros, busca e paginação
 */
exports.listEnrollments = async (req, res, next) => {
	try {
		const schoolId = req.query.schoolId || req.user?.school;

		const {
			page = parseInt(req.query.page) || 1,
			limit = parseInt(req.query.limit) || 10,
			sortBy = 'enrollmentDate',
			order = req.query.order === 'desc' ? -1 : 1
		} = req.query;

		const skip = (page - 1) * limit;

		if (!schoolId) {
			return res.status(400).json(createErrorResponse('School ID is required'));
		}

		const filter = { school: schoolId };

		// Filtros diretos
		if (req.query.student) filter.student = req.query.student;
		if (req.query.class) filter.class = req.query.class;
		if (req.query.status) filter.status = req.query.status;

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
						enrollments: [],
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

		// Filtro por yearLevel (indireto via class)
		if (req.query.yearLevel) {
			const classes = await Classes.find({
				yearLevel: req.query.yearLevel,
				school: schoolId
			});
			
			if (classes.length > 0) {
				// Se já temos um filtro de class, fazemos a interseção
				if (filter.class) {
					const classIds = classes.map(c => c._id.toString());
					// Garantir que estamos trabalhando com strings para comparação
					if (Array.isArray(filter.class.$in)) {
						filter.class.$in = filter.class.$in
							.map(id => id.toString())
							.filter(id => classIds.includes(id))
							.map(id => mongoose.Types.ObjectId(id));
						
						if (filter.class.$in.length === 0) {
							return res.status(200).json({
								success: true,
								data: {
									enrollments: [],
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
						// Se filter.class não é um array, verificar se está nas classes filtradas
						if (!classIds.includes(filter.class.toString())) {
							return res.status(200).json({
								success: true,
								data: {
									enrollments: [],
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
				} else {
					filter.class = { $in: classes.map(c => c._id) };
				}
			} else {
				// Se não encontrar classes com o filtro, retornar vazio
				return res.status(200).json({
					success: true,
					data: {
						enrollments: [],
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

		// Busca por rollNumber
		if (req.query.search) {
			filter.rollNumber = new RegExp(req.query.search, 'i');
		}

		// Filtro por intervalo de datas
		if (req.query.startDate) {
			filter.enrollmentDate = { ...filter.enrollmentDate, $gte: new Date(req.query.startDate) };
		}
		if (req.query.endDate) {
			filter.enrollmentDate = { ...filter.enrollmentDate, $lte: new Date(req.query.endDate) };
		}

		const [totalCount, enrollments] = await Promise.all([
			Enrollment.countDocuments(filter),
			Enrollment.find(filter)
				.populate({
					path: 'student',
					select: 'firstName lastName registrationNumber'
				})
				.populate({
					path: 'class',
					select: 'name yearLevel academicYear',
					populate: [
						{ path: 'yearLevel', select: 'name order' },
						{ path: 'academicYear', select: 'name startDate endDate' }
					]
				})
				.sort({ [sortBy]: order })
				.skip(skip)
				.limit(limit)
		]);

		const totalPages = Math.ceil(totalCount / limit);

		res.status(200).json({
			success: true,
			data: {
				enrollments,
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
 * Obtém detalhes de uma matrícula específica
 */
exports.getEnrollment = async (req, res, next) => {
	try {
		const enrollment = await Enrollment.findOne({
			_id: req.params.id,
			school: req.user.school
		})
			.populate({
				path: 'student',
				select: 'firstName lastName registrationNumber'
			})
			.populate({
				path: 'class',
				select: 'name yearLevel academicYear',
				populate: [
					{ path: 'yearLevel', select: 'name order' },
					{ path: 'academicYear', select: 'name startDate endDate' }
				]
			});

		if (!enrollment) return res.status(404).json(createErrorResponse('Enrollment not found'));

		res.json({ success: true, data: enrollment });
	} catch (err) { next(err); }
};

/**
 * Cria uma nova matrícula
 */
exports.createEnrollment = async (req, res, next) => {
	try {
		const { studentId, classId, enrollmentDate, rollNumber, status, documents, generalObservations, isTransfer } = req.body;

		// Validações básicas
		if (!studentId || !classId) {
			return res.status(400).json(createErrorResponse('Student ID and Class ID are required'));
		}

		// Verificar se o aluno existe
		const student = await Student.findOne({
			_id: studentId,
			school: req.user.school
		});

		if (!student) {
			return res.status(404).json(createErrorResponse('Student not found'));
		}

		// Verificar se a classe existe
		const classObj = await Classes.findOne({
			_id: classId,
			school: req.user.school
		}).populate('yearLevel');

		if (!classObj) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		// Verificar se já existe matrícula para este aluno nesta classe
		const existingEnrollment = await Enrollment.findOne({
			student: studentId,
			class: classId
		});

		if (existingEnrollment) {
			return res.status(400).json(createErrorResponse('Student is already enrolled in this class'));
		}

		// Determinar se a classe é curricular (tem disciplinas majoritariamente mandatory)
		const classSubjects = await Subjects.find({ 
			classes: classId,
			school: req.user.school
		});

		const mandatorySubjects = classSubjects.filter(s => s.type === 'mandatory');
		const isCurricular = mandatorySubjects.length > 0 && 
			(mandatorySubjects.length / classSubjects.length >= 0.5 || mandatorySubjects.length >= 3);

		// Validações específicas para turmas curriculares
		if (isCurricular) {
			// Verificar se o aluno já está matriculado em outra turma curricular no mesmo ano acadêmico
			const existingEnrollments = await Enrollment.find({
				student: studentId,
				status: 'studying'
			}).populate({
				path: 'class',
				select: 'academicYear',
				match: { academicYear: classObj.academicYear }
			});

			const curriculumEnrollments = existingEnrollments.filter(e => e.class !== null);
			
			if (curriculumEnrollments.length > 0) {
				return res.status(400).json(createErrorResponse(
					'Student already enrolled in another curriculum class for this academic year'
				));
			}

			// Verificar pré-requisitos (Year Level anterior) apenas para turmas curriculares
			if (classObj.yearLevel && classObj.yearLevel.order > 1) {
				// Verificar se o Year Level tem um pré-requisito específico
				const yearLevel = await YearLevel.findById(classObj.yearLevel._id);
				
				if (yearLevel.prerequisiteYearLevel) {
					// Verificar se o aluno foi aprovado no Year Level pré-requisito
					const prerequisiteApproved = await checkYearLevelApproval(
						studentId, 
						yearLevel.prerequisiteYearLevel
					);
					
					if (!prerequisiteApproved && !isTransfer) {
						return res.status(400).json(createErrorResponse(
							`Student must be approved in the prerequisite Year Level first`
						));
					}
				} else {
					// Se não tem pré-requisito específico, verificar o Year Level de ordem anterior
					const previousYearLevel = await YearLevel.findOne({
						order: classObj.yearLevel.order - 1,
						educationalSegment: classObj.educationalSegment
					});
					
					if (previousYearLevel) {
						const previousApproved = await checkYearLevelApproval(
							studentId, 
							previousYearLevel._id
						);
						
						if (!previousApproved && !isTransfer) {
							return res.status(400).json(createErrorResponse(
								`Student must be approved in the previous Year Level first`
							));
						}
					}
				}
			}
		}

		// Criar a matrícula
		const enrollment = await Enrollment.create({
			school: req.user.school,
			student: studentId,
			class: classId,
			enrollmentDate: enrollmentDate || new Date(),
			rollNumber,
			status: status || 'studying',
			documents,
			generalObservations
		});

		// Retornar com dados populados
		const populatedEnrollment = await Enrollment.findById(enrollment._id)
			.populate({
				path: 'student',
				select: 'firstName lastName registrationNumber'
			})
			.populate({
				path: 'class',
				select: 'name yearLevel academicYear',
				populate: [
					{ path: 'yearLevel', select: 'name order' },
					{ path: 'academicYear', select: 'name startDate endDate' }
				]
			});

		res.status(201).json({
			success: true,
			data: populatedEnrollment
		});
	} catch (err) { next(err); }
};

/**
 * Atualiza uma matrícula existente
 */
exports.updateEnrollment = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { rollNumber, status, documents, generalObservations, finalGrade } = req.body;

		// Verificar se a matrícula existe
		const enrollment = await Enrollment.findOne({
			_id: id,
			school: req.user.school
		});

		if (!enrollment) {
			return res.status(404).json(createErrorResponse('Enrollment not found'));
		}

		// Validar status
		if (status && !['studying', 'approved', 'failed', 'transferred', 'withdrawn'].includes(status)) {
			return res.status(400).json(createErrorResponse(
				'Invalid status. Must be one of: studying, approved, failed, transferred, withdrawn'
			));
		}

		// Atualizar campos permitidos
		const updates = {};
		if (rollNumber !== undefined) updates.rollNumber = rollNumber;
		if (status !== undefined) updates.status = status;
		if (documents !== undefined) updates.documents = documents;
		if (generalObservations !== undefined) updates.generalObservations = generalObservations;
		if (finalGrade !== undefined) updates.finalGrade = finalGrade;

		// Atualizar a matrícula
		const updatedEnrollment = await Enrollment.findByIdAndUpdate(
			id,
			{ $set: updates },
			{ new: true }
		)
			.populate({
				path: 'student',
				select: 'firstName lastName registrationNumber'
			})
			.populate({
				path: 'class',
				select: 'name yearLevel academicYear',
				populate: [
					{ path: 'yearLevel', select: 'name order' },
					{ path: 'academicYear', select: 'name startDate endDate' }
				]
			});

		res.json({
			success: true,
			data: updatedEnrollment,
			message: 'Enrollment updated successfully'
		});
	} catch (err) { next(err); }
};

/**
 * Exclui uma matrícula
 */
exports.deleteEnrollment = async (req, res, next) => {
	try {
		const { id } = req.params;

		// Verificar se a matrícula existe
		const enrollment = await Enrollment.findOne({
			_id: id,
			school: req.user.school
		});

		if (!enrollment) {
			return res.status(404).json(createErrorResponse('Enrollment not found'));
		}

		// Verificar se existem notas associadas a esta matrícula
		const hasMarks = await Marks.exists({
			student: enrollment.student,
			class: enrollment.class
		});

		if (hasMarks) {
			return res.status(400).json(createErrorResponse(
				'Cannot delete enrollment with associated marks. Change status to withdrawn instead.'
			));
		}

		// Excluir a matrícula
		await Enrollment.findByIdAndDelete(id);

		res.json({
			success: true,
			message: 'Enrollment deleted successfully'
		});
	} catch (err) { next(err); }
};

/**
 * Atualiza o status de uma matrícula
 */
exports.updateStatus = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { status, finalGrade } = req.body;

		// Validar status
		if (!['studying', 'approved', 'failed', 'transferred', 'withdrawn'].includes(status)) {
			return res.status(400).json(createErrorResponse(
				'Invalid status. Must be one of: studying, approved, failed, transferred, withdrawn'
			));
		}

		// Verificar se a matrícula existe
		const enrollment = await Enrollment.findOne({
			_id: id,
			school: req.user.school
		});

		if (!enrollment) {
			return res.status(404).json(createErrorResponse('Enrollment not found'));
		}

		// Atualizar status
		const updates = { status };
		if (finalGrade !== undefined) updates.finalGrade = finalGrade;

		const updatedEnrollment = await Enrollment.findByIdAndUpdate(
			id,
			{ $set: updates },
			{ new: true }
		)
			.populate({
				path: 'student',
				select: 'firstName lastName registrationNumber'
			})
			.populate({
				path: 'class',
				select: 'name yearLevel academicYear',
				populate: [
					{ path: 'yearLevel', select: 'name order' },
					{ path: 'academicYear', select: 'name startDate endDate' }
				]
			});

		res.json({
			success: true,
			data: updatedEnrollment,
			message: 'Enrollment status updated successfully'
		});
	} catch (err) { next(err); }
};

/**
 * Lista matrículas por aluno
 */
exports.listByStudent = async (req, res, next) => {
	try {
		const { studentId } = req.params;

		// Verificar se o aluno existe
		const student = await Student.findOne({
			_id: studentId,
			school: req.user.school
		});

		if (!student) {
			return res.status(404).json(createErrorResponse('Student not found'));
		}

		// Buscar todas as matrículas do aluno
		const enrollments = await Enrollment.find({
			student: studentId,
			school: req.user.school
		})
			.populate({
				path: 'class',
				select: 'name yearLevel academicYear',
				populate: [
					{ path: 'yearLevel', select: 'name order' },
					{ path: 'academicYear', select: 'name startDate endDate' }
				]
			})
			.sort({ 'class.academicYear.startDate': -1 }); // Ordenar por ano acadêmico mais recente

		res.json({
			success: true,
			data: enrollments
		});
	} catch (err) { next(err); }
};

/**
 * Lista matrículas por turma
 */
exports.listByClass = async (req, res, next) => {
	try {
		const { classId } = req.params;

		// Verificar se a turma existe
		const classObj = await Classes.findOne({
			_id: classId,
			school: req.user.school
		});

		if (!classObj) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		// Buscar todas as matrículas da turma
		const enrollments = await Enrollment.find({
			class: classId,
			school: req.user.school
		})
			.populate({
				path: 'student',
				select: 'firstName lastName registrationNumber'
			})
			.sort({ 'student.firstName': 1 }); // Ordenar por nome do aluno

		res.json({
			success: true,
			data: enrollments
		});
	} catch (err) { next(err); }
};

/**
 * Lista matrículas por ano acadêmico
 */
exports.listByAcademicYear = async (req, res, next) => {
	try {
		const { academicYearId } = req.params;
		
		// Primeiro, encontrar classes deste ano acadêmico
		const classes = await Classes.find({
			academicYear: academicYearId,
			school: req.user.school
		});
		
		if (!classes.length) {
			return res.json({
				success: true,
				data: []
			});
		}
		
		// Depois, buscar matrículas nestas classes
		const enrollments = await Enrollment.find({
			class: { $in: classes.map(c => c._id) },
			school: req.user.school
		})
			.populate({
				path: 'student',
				select: 'firstName lastName registrationNumber'
			})
			.populate({
				path: 'class',
				select: 'name yearLevel',
				populate: {
					path: 'yearLevel',
					select: 'name order'
				}
			});
		
		res.json({
			success: true,
			data: enrollments
		});
	} catch (err) { next(err); }
};

/**
 * Verifica pré-requisitos para matrícula
 */
exports.checkPrerequisites = async (req, res, next) => {
	try {
		const { studentId, classId } = req.params;

		// Verificar se o aluno e a classe existem
		const [student, classObj] = await Promise.all([
			Student.findOne({ _id: studentId, school: req.user.school }),
			Classes.findOne({ _id: classId, school: req.user.school }).populate('yearLevel')
		]);

		if (!student) {
			return res.status(404).json(createErrorResponse('Student not found'));
		}

		if (!classObj) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		// Se a classe não tem Year Level ou é uma série inicial, não há pré-requisitos
		if (!classObj.yearLevel || classObj.yearLevel.order <= 1) {
			return res.json({
				success: true,
				data: {
					eligible: true,
					message: 'No prerequisites required for this class'
				}
			});
		}

		// Verificar se o Year Level tem um pré-requisito específico
		const yearLevel = await YearLevel.findById(classObj.yearLevel._id);
		
		let prerequisiteYearLevelId = null;
		let prerequisiteMessage = '';
		
		if (yearLevel.prerequisiteYearLevel) {
			prerequisiteYearLevelId = yearLevel.prerequisiteYearLevel;
			const prerequisiteYearLevel = await YearLevel.findById(prerequisiteYearLevelId);
			prerequisiteMessage = `Student must be approved in ${prerequisiteYearLevel.name} first`;
		} else {
			// Se não tem pré-requisito específico, verificar o Year Level de ordem anterior
			const previousYearLevel = await YearLevel.findOne({
				order: classObj.yearLevel.order - 1,
				educationalSegment: classObj.educationalSegment
			});
			
			if (previousYearLevel) {
				prerequisiteYearLevelId = previousYearLevel._id;
				prerequisiteMessage = `Student must be approved in ${previousYearLevel.name} first`;
			} else {
				return res.json({
					success: true,
					data: {
						eligible: true,
						message: 'No prerequisites found for this class'
					}
				});
			}
		}
		
		// Verificar se o aluno foi aprovado no Year Level pré-requisito
		const prerequisiteApproved = await checkYearLevelApproval(
			studentId, 
			prerequisiteYearLevelId
		);
		
		res.json({
			success: true,
			data: {
				eligible: prerequisiteApproved,
				message: prerequisiteApproved ? 'Student meets all prerequisites' : prerequisiteMessage
			}
		});
	} catch (err) { next(err); }
};


/**
 * Obtém as disciplinas associadas a uma matrícula
 */
exports.getEnrollmentSubjects = async (req, res, next) => {
	try {
		const { id } = req.params;

		// Verificar se a matrícula existe
		const enrollment = await Enrollment.findOne({
			_id: id,
			school: req.user.school
		});

		if (!enrollment) return res.status(404).json(createErrorResponse('Enrollment not found'));

		// Buscar a classe
		const classObj = await Classes.findById(enrollment.class)
			.populate('yearLevel');

		console.info("classObj ===============================================");
		console.log(classObj);
		console.info("========================================================");

		if (!classObj) return res.status(404).json(createErrorResponse('Class not found'));

		// Buscar disciplinas obrigatórias do Year Level
		console.info("mandatorySubjects Query ===============================================");
		console.log("yearLevel ID", classObj.yearLevel._id);
		console.log("school", req.user.school);
		console.info("========================================================");

		const mandatorySubjects = await Subjects.find({
			yearLevel: classObj.yearLevel._id,
			type: 'mandatory',
			school: req.user.school
		}).populate('employees', 'firstName lastName email');

		console.info("mandatorySubjects ===============================================");
		console.log(mandatorySubjects);
		console.info("========================================================");

		// Buscar disciplinas extras da turma
		const extraSubjects = await Subjects.find({
			classes: classObj._id,
			type: { $in: ['complementary', 'elective'] },
			school: req.user.school
		}).populate('employees', 'firstName lastName email');

		console.info("extraSubjects ===============================================");
		console.log(extraSubjects);
		console.info("========================================================");

		// Buscar notas do aluno para cada disciplina
		const subjectsWithMarks = await Promise.all([...mandatorySubjects, ...extraSubjects].map(async (subject) => {
			const marks = await Marks.find({
				student: enrollment.student,
				subject: subject._id,
				class: classObj._id
			}).sort({ date: 1 });

			console.info("marks ===============================================");
			console.log(marks);
			console.info("========================================================");

			// Calcular média se houver notas
			let average = null;
			let passed = null;

			if (marks.length > 0) {
				const sum = marks.reduce((acc, mark) => acc + mark.grade, 0);
				average = sum / marks.length;
				passed = average >= subject.minGradeToPass;
			}

			return {
				...subject.toObject(),
				marks,
				average,
				passed,
				isMandatory: subject.type === 'mandatory'
			};
		}));

		console.info("subjectsWithMarks ===============================================");
		console.log(subjectsWithMarks);
		console.info("========================================================");

		res.json({
			success: true,
			data: {
				mandatorySubjects: subjectsWithMarks.filter(s => s.isMandatory),
				extraSubjects: subjectsWithMarks.filter(s => !s.isMandatory)
			}
		});
	} catch (err) { next(err); }
};

/**
 * Atualiza o status de múltiplas matrículas
 */
exports.bulkUpdateStatus = async (req, res, next) => {
	try {
		const { enrollmentIds, status } = req.body;

		// Validações básicas
		if (!enrollmentIds || !Array.isArray(enrollmentIds) || enrollmentIds.length === 0) {
			return res.status(400).json(createErrorResponse('Enrollment IDs are required'));
		}

		if (!status || !['studying', 'approved', 'failed', 'transferred', 'withdrawn'].includes(status)) {
			return res.status(400).json(createErrorResponse(
				'Invalid status. Must be one of: studying, approved, failed, transferred, withdrawn'
			));
		}

		// Verificar se todas as matrículas existem e pertencem à escola do usuário
		const enrollments = await Enrollment.find({
			_id: { $in: enrollmentIds },
			school: req.user.school
		});

		if (enrollments.length !== enrollmentIds.length) {
			return res.status(400).json(createErrorResponse(
				'One or more enrollments not found or not authorized'
			));
		}

		// Atualizar o status de todas as matrículas
		const updateResult = await Enrollment.updateMany(
			{ _id: { $in: enrollmentIds } },
			{ $set: { status } }
		);

		res.json({
			success: true,
			data: {
				modifiedCount: updateResult.modifiedCount,
				enrollmentIds
			},
			message: `Status updated to ${status} for ${updateResult.modifiedCount} enrollments`
		});
	} catch (err) { next(err); }
};


/**
 * Função auxiliar para verificar aprovação em um Year Level
 * @param {string} studentId - ID do aluno
 * @param {string} yearLevelId - ID do Year Level
 * @returns {Promise<boolean>} - True se aprovado, False caso contrário
 */
async function checkYearLevelApproval(studentId, yearLevelId) {
	// Buscar classes deste Year Level
	const classes = await Classes.find({ yearLevel: yearLevelId });
	
	if (!classes.length) return false;
	
	// Verificar se o aluno foi aprovado em alguma classe deste Year Level
	const enrollments = await Enrollment.find({
		student: studentId,
		class: { $in: classes.map(c => c._id) },
		status: 'approved'
	});
	
	return enrollments.length > 0;
}