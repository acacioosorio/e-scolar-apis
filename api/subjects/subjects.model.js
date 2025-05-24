// Subjects Model
// ./api/subjects/subjects.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
mongoose.Promise = global.Promise;

const SubjectSchema = new Schema(
	{
		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: [true, "School is required"],
		},
		// Ex: "Matemática", "Português", "Inglês"
		name: {
			type: String,
			required: [true, "Please add a Subject name"],
		},
		code: {
			type: String,
		},
		// Removido academicYear e yearLevel diretos
		// Associação apenas com classes
		classes: [{
			type: Schema.Types.ObjectId,
			ref: 'Classes'
		}],
		type: {
			type: String,
			enum: ['mandatory', 'complementary', 'elective'],
			required: [true, "Please add a Subject type"],
		},
		employees: [
			{
				type: Schema.Types.ObjectId,
				ref: "Users",
				required: true,
			},
		],
		status: {
			type: String,
			enum: ['active', 'inactive', 'archived'],
			default: 'active',
		},
		description: String,

		// Carga horária total da disciplina (em horas)
		workload: {
			type: Number,
			required: [true, "A carga horária é obrigatória"],
			min: 0
		},

		// Créditos acadêmicos
		credits: {
			type: Number,
			required: [true, "O número de créditos é obrigatório"],
			min: 0
		},

		// Média mínima para aprovação
		minGradeToPass: {
			type: Number,
			default: 6.0, // Valor padrão, ajuste conforme sua necessidade
			min: 0,
			max: 10
		},

		// Pré-requisitos: disciplinas que devem ser cursadas antes
		prerequisites: [{
			subject: {
				type: Schema.Types.ObjectId,
				ref: 'Subjects'
			},
			minGrade: {
				type: Number,
				default: 6.0 // Nota mínima no pré-requisito
			}
		}],
	},
	{ timestamps: true }
);

// Índice ajustado para não incluir academicYear e yearLevel
SubjectSchema.index({ school: 1, code: 1 }, { unique: true });
// Índice para consultas por classes
SubjectSchema.index({ classes: 1 });

module.exports = mongoose.models.Subjects || mongoose.model('Subjects', SubjectSchema);