// Academic Progress Model
// ./api/academic-progress/academicProgress.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = global.Promise;

/**
 * Modelo de AcademicProgress (Progresso Acadêmico)
 * 
 * Este modelo consolida o progresso acadêmico de um aluno em um ano letivo,
 * armazenando os resultados finais em todas as disciplinas e o status geral
 * de aprovação/reprovação para o próximo nível.
 */
const AcademicProgressSchema = new Schema(
	{
		// Escola relacionada
		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: [true, "School is required"],
		},

		// Aluno avaliado
		student: {
			type: Schema.Types.ObjectId,
			ref: "Student",
			required: [true, "Student is required"],
		},

		// Ano acadêmico
		academicYear: {
			type: Schema.Types.ObjectId,
			ref: "AcademicYear",
			required: [true, "Academic year is required"],
		},

		// Turma do aluno
		class: {
			type: Schema.Types.ObjectId,
			ref: "Classes",
			required: [true, "Class is required"],
		},

		// Nível de ano (série)
		yearLevel: {
			type: Schema.Types.ObjectId,
			ref: "YearLevel",
			required: [true, "Year level is required"],
		},

		// Resultados por disciplina
		subjectResults: [{
			// Disciplina
			subject: {
				type: Schema.Types.ObjectId,
				ref: "Subjects",
				required: true
			},

			// Média final
			finalAverage: {
				type: Number,
				required: true,
				min: 0,
				max: 10
			},

			// Nota mínima para aprovação
			requiredGrade: {
				type: Number,
				required: true,
				min: 0,
				max: 10
			},

			// Indica se foi aprovado nesta disciplina
			passed: {
				type: Boolean,
				required: true
			},

			// Nota de recuperação (se aplicável)
			recoveryGrade: {
				type: Number,
				min: 0,
				max: 10
			},

			// Status final na disciplina
			finalStatus: {
				type: String,
				enum: ['approved', 'failed', 'recovery', 'pending', 'exempted'],
				default: 'pending'
			},

			// Observações específicas para esta disciplina
			comments: String
		}],

		// Status geral do aluno no ano letivo
		overallStatus: {
			type: String,
			enum: ['approved', 'failed', 'recovery', 'pending', 'conditional'],
			default: 'pending'
		},

		// Indica se o aluno foi promovido para o próximo nível
		promotedToNextLevel: {
			type: Boolean,
			default: false
		},

		// Próximo nível para o qual o aluno foi promovido (se aplicável)
		nextYearLevel: {
			type: Schema.Types.ObjectId,
			ref: "YearLevel"
		},

		// Média geral de todas as disciplinas
		overallAverage: {
			type: Number,
			min: 0,
			max: 10
		},

		// Percentual de disciplinas aprovadas
		approvalPercentage: {
			type: Number,
			min: 0,
			max: 100
		},

		// Data da avaliação final
		evaluationDate: {
			type: Date
		},

		// Usuário que realizou a avaliação final
		evaluatedBy: {
			type: Schema.Types.ObjectId,
			ref: "Users"
		},

		// Indica se passou por conselho de classe
		reviewedByCouncil: {
			type: Boolean,
			default: false
		},

		// Decisão do conselho (se aplicável)
		councilDecision: {
			type: String,
			enum: ['approved', 'failed', 'conditional', 'not_applicable'],
			default: 'not_applicable'
		},

		// Data da decisão do conselho
		councilDate: {
			type: Date
		},

		// Observações gerais sobre o desempenho do aluno
		observations: String,

		// Status do registro (para controle de workflow)
		status: {
			type: String,
			enum: ['draft', 'in_review', 'final'],
			default: 'draft'
		}
	},
	{ timestamps: true }
);

// Índices para otimizar consultas comuns
AcademicProgressSchema.index({ school: 1, academicYear: 1 });
AcademicProgressSchema.index({ student: 1, academicYear: 1 }, { unique: true });
AcademicProgressSchema.index({ class: 1, academicYear: 1 });
AcademicProgressSchema.index({ yearLevel: 1, academicYear: 1 });
AcademicProgressSchema.index({ overallStatus: 1, academicYear: 1 });

/**
 * Método para atualizar o progresso acadêmico com base nas notas atuais
 */
AcademicProgressSchema.methods.updateFromMarks = async function () {
	const Marks = mongoose.model('Marks');
	const Subject = mongoose.model('Subjects');

	// Buscar todas as disciplinas da turma
	const subjects = await Subject.find({
		classes: this.class,
		academicYear: this.academicYear
	});

	// Para cada disciplina, calcular a média e verificar aprovação
	const subjectResults = await Promise.all(
		subjects.map(async (subject) => {
			const result = await Marks.checkApproval(
				this.student,
				subject._id,
				this.academicYear
			);

			return {
				subject: subject._id,
				finalAverage: result.average,
				requiredGrade: result.minGradeToPass,
				passed: result.approved,
				finalStatus: result.approved ? 'approved' : 'failed'
			};
		})
	);

	// Atualizar os resultados por disciplina
	this.subjectResults = subjectResults;

	// Calcular estatísticas gerais
	const totalSubjects = subjectResults.length;
	const approvedSubjects = subjectResults.filter(r => r.passed).length;

	this.overallAverage = totalSubjects > 0
		? parseFloat((subjectResults.reduce((sum, r) => sum + r.finalAverage, 0) / totalSubjects).toFixed(2))
		: 0;

	this.approvalPercentage = totalSubjects > 0
		? parseFloat(((approvedSubjects / totalSubjects) * 100).toFixed(2))
		: 0;

	// Determinar status geral
	const allPassed = approvedSubjects === totalSubjects && totalSubjects > 0;
	this.overallStatus = allPassed ? 'approved' : 'failed';
	this.promotedToNextLevel = allPassed;

	// Atualizar data de avaliação
	this.evaluationDate = new Date();

	return this;
};

/**
 * Método para aplicar decisão do conselho de classe
 */
AcademicProgressSchema.methods.applyCouncilDecision = function (decision, userId, observations = '') {
	this.reviewedByCouncil = true;
	this.councilDecision = decision;
	this.councilDate = new Date();

	// Se o conselho aprovar, atualizar status geral
	if (decision === 'approved') {
		this.overallStatus = 'approved';
		this.promotedToNextLevel = true;
	} else if (decision === 'failed') {
		this.overallStatus = 'failed';
		this.promotedToNextLevel = false;
	} else if (decision === 'conditional') {
		this.overallStatus = 'conditional';
		this.promotedToNextLevel = true;
	}

	// Adicionar observações
	if (observations) {
		this.observations = observations;
	}

	// Registrar quem avaliou
	this.evaluatedBy = userId;

	// Marcar como final
	this.status = 'final';

	return this;
};

/**
 * Método estático para buscar o progresso de um aluno
 */
AcademicProgressSchema.statics.findOrCreateProgress = async function (studentId, academicYearId, classId, yearLevelId, schoolId) {
	// Buscar progresso existente
	let progress = await this.findOne({
		student: studentId,
		academicYear: academicYearId
	});

	// Se não existir, criar novo
	if (!progress) {
		progress = new this({
			student: studentId,
			academicYear: academicYearId,
			class: classId,
			yearLevel: yearLevelId,
			school: schoolId,
			subjectResults: [],
			status: 'draft'
		});
	}

	return progress;
};

/**
 * Método estático para gerar relatório de turma
 */
AcademicProgressSchema.statics.generateClassReport = async function (classId, academicYearId) {
	// Buscar todos os registros de progresso para esta turma
	const progressRecords = await this.find({
		class: classId,
		academicYear: academicYearId
	}).populate('student', 'name admissionNumber');

	// Calcular estatísticas da turma
	const totalStudents = progressRecords.length;
	const approvedStudents = progressRecords.filter(p => p.overallStatus === 'approved').length;
	const failedStudents = progressRecords.filter(p => p.overallStatus === 'failed').length;
	const pendingStudents = progressRecords.filter(p => p.overallStatus === 'pending').length;
	const recoveryStudents = progressRecords.filter(p => p.overallStatus === 'recovery').length;

	// Calcular médias gerais
	const classAverage = totalStudents > 0
		? parseFloat((progressRecords.reduce((sum, p) => sum + (p.overallAverage || 0), 0) / totalStudents).toFixed(2))
		: 0;

	const approvalRate = totalStudents > 0
		? parseFloat(((approvedStudents / totalStudents) * 100).toFixed(2))
		: 0;

	return {
		class: classId,
		academicYear: academicYearId,
		totalStudents,
		approvedStudents,
		failedStudents,
		pendingStudents,
		recoveryStudents,
		classAverage,
		approvalRate,
		studentRecords: progressRecords
	};
};

module.exports = mongoose.models.AcademicProgress || mongoose.model('AcademicProgress', AcademicProgressSchema);