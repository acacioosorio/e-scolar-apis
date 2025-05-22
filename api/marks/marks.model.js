// Marks Model
// ./api/marks/marks.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = global.Promise;

/**
 * Modelo de Marks (Notas)
 * 
 * Este modelo armazena as avaliações dos alunos em cada disciplina.
 * Cada registro representa uma nota específica de um aluno em uma avaliação
 * de uma disciplina, dentro de um período letivo e turma.
 */
const MarksSchema = new Schema(
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

		// Disciplina avaliada
		subject: {
			type: Schema.Types.ObjectId,
			ref: "Subjects",
			required: [true, "Subject is required"],
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

		// Período de avaliação (bimestre, trimestre, semestre)
		evaluationPeriod: {
			type: String,
			enum: ['first', 'second', 'third', 'fourth', 'final', 'recovery'],
			required: [true, "Evaluation period is required"],
		},

		// Tipo de avaliação
		evaluationType: {
			type: String,
			enum: ['test', 'exam', 'assignment', 'project', 'presentation', 'participation', 'other'],
			required: [true, "Evaluation type is required"],
		},

		// Título da avaliação
		title: {
			type: String,
			required: [true, "Evaluation title is required"],
		},

		// Nota obtida pelo aluno
		grade: {
			type: Number,
			required: [true, "Grade is required"],
			min: 0,
			max: 10,
		},

		// Peso da avaliação no cálculo da média
		weight: {
			type: Number,
			default: 1,
			min: 0,
		},

		// Data da avaliação
		date: {
			type: Date,
			required: [true, "Evaluation date is required"],
		},

		// Professor que registrou a nota
		registeredBy: {
			type: Schema.Types.ObjectId,
			ref: "Users",
			required: [true, "User who registered the mark is required"],
		},

		// Comentários sobre o desempenho do aluno
		comments: String,

		// Status da nota (se foi revisada, confirmada, etc.)
		status: {
			type: String,
			enum: ['draft', 'published', 'revised', 'final'],
			default: 'published',
		},

		// Indica se é uma nota de recuperação
		isRecovery: {
			type: Boolean,
			default: false,
		},

		// Metadados adicionais (pode armazenar informações específicas)
		metadata: {
			type: Schema.Types.Mixed,
		},
	},
	{ timestamps: true }
);

// Índices para otimizar consultas comuns
MarksSchema.index({ school: 1, academicYear: 1 });
MarksSchema.index({ student: 1, academicYear: 1 });
MarksSchema.index({ subject: 1, class: 1, academicYear: 1 });
MarksSchema.index({ student: 1, subject: 1, academicYear: 1, evaluationPeriod: 1 });

/**
 * Método para calcular a média das notas de um aluno em uma disciplina e período
 */
MarksSchema.statics.calculateAverage = async function (studentId, subjectId, academicYearId, evaluationPeriod = null) {
	const query = {
		student: studentId,
		subject: subjectId,
		academicYear: academicYearId,
	};

	// Se um período específico for fornecido, filtrar por ele
	if (evaluationPeriod) {
		query.evaluationPeriod = evaluationPeriod;
	}

	const marks = await this.find(query);

	if (!marks || marks.length === 0) {
		return {
			average: 0,
			totalMarks: 0,
			message: "No marks found for this student in this subject"
		};
	}

	let totalWeight = 0;
	let weightedSum = 0;

	marks.forEach(mark => {
		weightedSum += mark.grade * mark.weight;
		totalWeight += mark.weight;
	});

	const average = totalWeight > 0 ? weightedSum / totalWeight : 0;

	return {
		average: parseFloat(average.toFixed(2)),
		totalMarks: marks.length,
		totalWeight,
		marks
	};
};

/**
 * Método para verificar se um aluno atingiu a nota mínima em uma disciplina
 */
MarksSchema.statics.checkApproval = async function (studentId, subjectId, academicYearId) {
	// Calcular a média do aluno
	const result = await this.calculateAverage(studentId, subjectId, academicYearId);

	// Buscar a disciplina para obter a nota mínima para aprovação
	const Subject = mongoose.model('Subjects');
	const subject = await Subject.findById(subjectId);

	if (!subject) {
		throw new Error('Subject not found');
	}

	const minGradeToPass = subject.minGradeToPass || 6.0; // Valor padrão caso não esteja definido

	return {
		average: result.average,
		minGradeToPass,
		approved: result.average >= minGradeToPass && result.totalMarks > 0,
		totalMarks: result.totalMarks,
		subject: subject.name
	};
};

/**
 * Método para obter o boletim completo de um aluno
 */
MarksSchema.statics.getStudentReport = async function (studentId, academicYearId, classId) {
	// Buscar todas as disciplinas da turma
	const Subject = mongoose.model('Subjects');
	const subjects = await Subject.find({
		classes: classId,
		academicYear: academicYearId
	});

	// Para cada disciplina, calcular a média e verificar aprovação
	const results = await Promise.all(
		subjects.map(async (subject) => {
			const approval = await this.checkApproval(studentId, subject._id, academicYearId);

			// Buscar notas por período para esta disciplina
			const periods = ['first', 'second', 'third', 'fourth', 'final', 'recovery'];
			const periodResults = {};

			for (const period of periods) {
				const periodResult = await this.calculateAverage(
					studentId, subject._id, academicYearId, period
				);

				if (periodResult.totalMarks > 0) {
					periodResults[period] = periodResult.average;
				}
			}

			return {
				subject: {
					_id: subject._id,
					name: subject.name,
					code: subject.code,
					type: subject.type
				},
				average: approval.average,
				minGradeToPass: approval.minGradeToPass,
				approved: approval.approved,
				periodGrades: periodResults
			};
		})
	);

	// Calcular estatísticas gerais
	const totalSubjects = results.length;
	const approvedSubjects = results.filter(r => r.approved).length;
	const overallAverage = results.reduce((sum, r) => sum + r.average, 0) / (totalSubjects || 1);

	return {
		student: studentId,
		academicYear: academicYearId,
		class: classId,
		subjects: results,
		statistics: {
			totalSubjects,
			approvedSubjects,
			overallAverage: parseFloat(overallAverage.toFixed(2)),
			approvalPercentage: totalSubjects > 0
				? parseFloat(((approvedSubjects / totalSubjects) * 100).toFixed(2))
				: 0
		},
		approved: approvedSubjects === totalSubjects && totalSubjects > 0
	};
};

module.exports = mongoose.models.Marks || mongoose.model('Marks', MarksSchema);
