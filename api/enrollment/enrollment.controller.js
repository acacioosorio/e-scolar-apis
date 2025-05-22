// Enrollment Controller
// ./api/enrollment/enrollment.controller.js

const School = require("../schools/school.model");
const Student = require("../students/students.model");
const Classes = require("../classes/classes.model");
const YearLevel = require("../pedagogy/yearLevel.model");
const Enrollment = require('./enrollment.model');
const AcademicYear = require('../academic-years/academicYear.model');
const Subjects = require('../subjects/subjects.model');
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

		if (req.user && req.user.school.toString() !== schoolId.toString() && req.user.role !== 'master')
			return res.status(403).json(createErrorResponse('Not authorized to view enrollments from this school'));

		const school = await School.findById(schoolId);

		if (!school)
			return res.status(404).json(createErrorResponse('School not found'));

		const filter = { school: schoolId };

		// Filtros adicionais
		if (req.query.status) filter.status = req.query.status;
		if (req.query.academicYear) filter.academicYear = req.query.academicYear;
		if (req.query.studentId) filter.student = req.query.studentId;
		if (req.query.classId) filter.class = req.query.classId;

		// Filtro por tipo de matrícula (curricular/extracurricular)
		if (req.query.enrollmentType) {
			const enrollmentType = req.query.enrollmentType;

			if (enrollmentType === 'curricular') {
				// Buscar classes que têm disciplinas majoritariamente mandatory
				const classesWithMandatorySubjects = await getClassesWithMandatorySubjects(schoolId);
				filter.class = { $in: classesWithMandatorySubjects };
			} else if (enrollmentType === 'extracurricular') {
				// Buscar classes que não têm disciplinas majoritariamente mandatory
				const classesWithMandatorySubjects = await getClassesWithMandatorySubjects(schoolId);
				filter.class = { $nin: classesWithMandatorySubjects };
			}
		}

		// Busca por nome do aluno (requer populate)
		const searchQuery = req.query.search || '';
		let enrollmentsQuery = Enrollment.find(filter)
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
			})
			.sort({ [sortBy]: order === 'desc' ? -1 : 1 })
			.skip(+skip)
			.limit(+limit);

		// Aplicar filtro de busca após o populate
		if (searchQuery) {
			const enrollments = await enrollmentsQuery;
			const filteredEnrollments = enrollments.filter(enrollment => {
				const studentName = `${enrollment.student.firstName} ${enrollment.student.lastName}`.toLowerCase();
				const regNumber = enrollment.student.registrationNumber?.toLowerCase() || '';
				const className = enrollment.class.name.toLowerCase();

				return studentName.includes(searchQuery.toLowerCase()) ||
					regNumber.includes(searchQuery.toLowerCase()) ||
					className.includes(searchQuery.toLowerCase());
			});

			const totalCount = filteredEnrollments.length;
			const totalPages = Math.ceil(totalCount / limit);

			return res.status(200).json({
				success: true,
				data: {
					enrollments: filteredEnrollments,
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
		}

		// Sem filtro de busca, usar countDocuments para eficiência
		const [totalCount, enrollments] = await Promise.all([
			Enrollment.countDocuments(filter),
			enrollmentsQuery
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
				select: 'firstName lastName registrationNumber dateOfBirth gender contactInformation'
			})
			.populate({
				path: 'class',
				select: 'name yearLevel academicYear',
				populate: {
					path: 'yearLevel',
					select: 'name order'
				}
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
		const { student: studentId, class: classId, academicYear, enrollmentDate, rollNumber, status, documents, generalObservations } = req.body;

		// Validações básicas
		if (!studentId || !classId || !academicYear) {
			return res.status(400).json(createErrorResponse('Student, class and academic year are required'));
		}

		// Verificar se o estudante existe
		const student = await Student.findOne({ _id: studentId, school: req.user.school });
		if (!student) {
			return res.status(404).json(createErrorResponse('Student not found'));
		}

		// Verificar se a classe existe
		const classObj = await Classes.findOne({ _id: classId, school: req.user.school })
			.populate('yearLevel');
		if (!classObj) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		// Verificar se o ano acadêmico existe
		const academicYearObj = await AcademicYear.findOne({
			_id: academicYear,
			school: req.user.school
		});
		if (!academicYearObj) {
			return res.status(404).json(createErrorResponse('Academic year not found'));
		}

		// Verificar se o aluno já está matriculado nesta classe específica
		const existingClassEnrollment = await Enrollment.findOne({
			student: studentId,
			class: classId
		});

		if (existingClassEnrollment) {
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
				academicYear: academicYear,
				class: { $ne: classId }
			}).populate('class');

			// Para cada matrícula existente, verificar se a turma é curricular
			for (const enrollment of existingEnrollments) {
				const enrollmentClassSubjects = await Subjects.find({
					classes: enrollment.class._id,
					school: req.user.school
				});

				const enrollmentMandatorySubjects = enrollmentClassSubjects.filter(s => s.type === 'mandatory');
				const isEnrollmentCurricular = enrollmentMandatorySubjects.length > 0 &&
					(enrollmentMandatorySubjects.length / enrollmentClassSubjects.length >= 0.5 ||
						enrollmentMandatorySubjects.length >= 3);

				if (isEnrollmentCurricular) {
					return res.status(400).json(createErrorResponse(
						'Student is already enrolled in another curricular class for this academic year'
					));
				}
			}

			// Verificar pré-requisitos (Year Level anterior) apenas para turmas curriculares
			if (classObj.yearLevel && classObj.yearLevel.order > 1) {
				// Verificar se o Year Level tem um pré-requisito específico
				const yearLevel = await YearLevel.findById(classObj.yearLevel._id);

				if (yearLevel.prerequisiteYearLevel) {
					// Verificar se o aluno foi aprovado no Year Level pré-requisito
					const prerequisiteClasses = await Classes.find({
						yearLevel: yearLevel.prerequisiteYearLevel
					});

					if (prerequisiteClasses.length > 0) {
						// Buscar matrículas do aluno nas turmas do Year Level pré-requisito
						const prerequisiteEnrollments = await Enrollment.find({
							student: studentId,
							class: { $in: prerequisiteClasses.map(c => c._id) }
						});

						// Verificar se o aluno foi aprovado em todas as disciplinas mandatórias
						let allMandatoryPassed = true;

						for (const enrollment of prerequisiteEnrollments) {
							// Buscar disciplinas mandatórias da turma
							const mandatorySubjects = await Subjects.find({
								classes: enrollment.class,
								type: 'mandatory'
							});

							// Verificar aprovação em cada disciplina mandatória
							for (const subject of mandatorySubjects) {
								const marks = await Marks.find({
									student: studentId,
									subject: subject._id
								});

								if (marks.length === 0) {
									allMandatoryPassed = false;
									break;
								}

								// Calcular média das notas
								const sum = marks.reduce((acc, mark) => acc + mark.grade, 0);
								const average = sum / marks.length;

								if (average < subject.minGradeToPass) {
									allMandatoryPassed = false;
									break;
								}
							}

							if (!allMandatoryPassed) break;
						}

						if (!allMandatoryPassed && status !== 'transferred') {
							return res.status(400).json(createErrorResponse(
								'Student has not been approved in all mandatory subjects of the prerequisite year level'
							));
						}
					}
				} else {
					// Se não há pré-requisito específico, verificar o Year Level de ordem anterior
					const previousYearLevel = await YearLevel.findOne({
						school: req.user.school,
						order: classObj.yearLevel.order - 1
					});

					if (previousYearLevel) {
						// Buscar classes do Year Level anterior
						const previousClasses = await Classes.find({
							yearLevel: previousYearLevel._id
						});

						if (previousClasses.length > 0) {
							// Verificar se o aluno foi aprovado em alguma classe do Year Level anterior
							const previousEnrollments = await Enrollment.find({
								student: studentId,
								class: { $in: previousClasses.map(c => c._id) }
							});

							if (previousEnrollments.length === 0 && status !== 'transferred') {
								return res.status(400).json(createErrorResponse(
									'Student has not been enrolled in the previous year level'
								));
							}

							// Verificar se o aluno foi aprovado em todas as disciplinas mandatórias
							let allMandatoryPassed = true;

							for (const enrollment of previousEnrollments) {
								// Buscar disciplinas mandatórias da turma
								const mandatorySubjects = await Subjects.find({
									classes: enrollment.class,
									type: 'mandatory'
								});

								// Verificar aprovação em cada disciplina mandatória
								for (const subject of mandatorySubjects) {
									const marks = await Marks.find({
										student: studentId,
										subject: subject._id
									});

									if (marks.length === 0) {
										allMandatoryPassed = false;
										break;
									}

									// Calcular média das notas
									const sum = marks.reduce((acc, mark) => acc + mark.grade, 0);
									const average = sum / marks.length;

									if (average < subject.minGradeToPass) {
										allMandatoryPassed = false;
										break;
									}
								}

								if (!allMandatoryPassed) break;
							}

							if (!allMandatoryPassed && status !== 'transferred') {
								return res.status(400).json(createErrorResponse(
									'Student has not been approved in all mandatory subjects of the previous year level'
								));
							}
						}
					}
				}
			}
		}
		// Para turmas extracurriculares (não curriculares), não há verificação de unicidade por ano acadêmico
		// nem verificação de pré-requisitos de Year Level

		// Criar a matrícula
		const enrollment = await Enrollment.create({
			school: req.user.school,
			student: studentId,
			class: classId,
			academicYear,
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
				select: 'name yearLevel',
				populate: {
					path: 'yearLevel',
					select: 'name order'
				}
			});

		res.status(201).json({
			success: true,
			data: populatedEnrollment,
			message: 'Enrollment created successfully'
		});
	} catch (err) {
		if (err.code === 11000) {
			return res.status(400).json(createErrorResponse('Duplicate enrollment. Student may already be enrolled in this class.'));
		}
		next(err);
	}
};

/**
 * Atualiza uma matrícula existente
 */
exports.updateEnrollment = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { rollNumber, status, documents, generalObservations, finalGrade } = req.body;

		// Não permitir atualização de student, class ou academicYear
		if (req.body.student || req.body.class || req.body.academicYear) {
			return res.status(400).json(createErrorResponse(
				'Cannot update student, class or academic year. Create a new enrollment instead.'
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
				select: 'name yearLevel',
				populate: {
					path: 'yearLevel',
					select: 'name order'
				}
			});

		res.json({
			success: true,
			data: updatedEnrollment,
			message: 'Enrollment updated successfully'
		});
	} catch (err) { next(err); }
};

/**
 * Atualiza o status de uma matrícula
 */
exports.updateEnrollmentStatus = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { status } = req.body;

		// Verificar se a matrícula existe
		const enrollment = await Enrollment.findOne({
			_id: id,
			school: req.user.school
		});

		if (!enrollment) {
			return res.status(404).json(createErrorResponse('Enrollment not found'));
		}

		// Validar status
		if (!status || !['studying', 'approved', 'failed', 'transferred', 'withdrawn'].includes(status)) {
			return res.status(400).json(createErrorResponse(
				'Invalid status. Must be one of: studying, approved, failed, transferred, withdrawn'
			));
		}

		// Atualizar o status
		const updatedEnrollment = await Enrollment.findByIdAndUpdate(
			id,
			{ $set: { status } },
			{ new: true }
		)
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
			data: updatedEnrollment,
			message: 'Enrollment status updated successfully'
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

		// Verificar se existem notas ou outros registros dependentes
		const hasMarks = await Marks.exists({
			student: enrollment.student,
			class: enrollment.class
		});

		if (hasMarks) {
			return res.status(400).json(createErrorResponse(
				'Cannot delete enrollment with associated marks. Update status to withdrawn instead.'
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
 * Lista matrículas de um aluno específico
 */
exports.getStudentEnrollments = async (req, res, next) => {
	try {
		const { studentId } = req.params;
		const { academicYear } = req.query;

		const filter = {
			student: studentId,
			school: req.user.school
		};

		if (academicYear) {
			filter.academicYear = academicYear;
		}

		const enrollments = await Enrollment.find(filter)
			.populate({
				path: 'class',
				select: 'name yearLevel academicYear',
				populate: {
					path: 'yearLevel',
					select: 'name order'
				}
			})
			.sort({ enrollmentDate: -1 });

		res.json({
			success: true,
			data: enrollments
		});
	} catch (err) { next(err); }
};

/**
 * Lista alunos matriculados em uma turma específica
 */
exports.getClassEnrollments = async (req, res, next) => {
	try {
		const { classId } = req.params;
		const { status } = req.query;

		const filter = {
			class: classId,
			school: req.user.school
		};

		if (status) {
			filter.status = status;
		}

		const enrollments = await Enrollment.find(filter)
			.populate({
				path: 'student',
				select: 'firstName lastName registrationNumber dateOfBirth gender contactInformation'
			})
			.sort({ 'student.firstName': 1, 'student.lastName': 1 });

		res.json({
			success: true,
			data: enrollments
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

		if (!classObj) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

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
 * Função auxiliar para obter classes com disciplinas majoritariamente mandatórias
 */
async function getClassesWithMandatorySubjects(schoolId) {
	// Buscar todas as classes da escola
	const classes = await Classes.find({ school: schoolId });
	const result = [];

	for (const classObj of classes) {
		// Buscar disciplinas da turma
		const subjects = await Subjects.find({
			classes: classObj._id,
			school: schoolId
		});

		if (subjects.length === 0) continue;

		// Verificar se a maioria das disciplinas é mandatória
		const mandatorySubjects = subjects.filter(s => s.type === 'mandatory');

		if (mandatorySubjects.length > 0 &&
			(mandatorySubjects.length / subjects.length >= 0.5 || mandatorySubjects.length >= 3)) {
			result.push(classObj._id);
		}
	}

	return result;
}