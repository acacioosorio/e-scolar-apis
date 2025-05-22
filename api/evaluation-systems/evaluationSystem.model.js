// Evaluation System Model
// /api/evaluation-systems/evaluationSystem.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Modelo de EvaluationSystem (Sistema de Avaliação)
 * 
 * Este modelo define diferentes sistemas de avaliação que podem ser
 * utilizados pela escola, como numérico (0-10), conceitual (A-E),
 * descritivo, ou outros formatos personalizados.
 */
const EvaluationSystemSchema = new Schema(
	{
		// Escola relacionada
		school: {
			type: Schema.Types.ObjectId,
			ref: "School",
			required: [true, "School is required"],
		},

		// Nome do sistema de avaliação
		name: {
			type: String,
			required: [true, "Name is required"],
			trim: true,
		},

		// Descrição do sistema
		description: {
			type: String,
			trim: true,
		},

		// Tipo do sistema de avaliação
		type: {
			type: String,
			enum: ['numeric', 'conceptual', 'descriptive', 'custom'],
			required: [true, "Type is required"],
		},

		// Configuração do sistema numérico
		numericConfig: {
			// Valor mínimo (geralmente 0)
			minValue: {
				type: Number,
				default: 0,
			},

			// Valor máximo (geralmente 10)
			maxValue: {
				type: Number,
				default: 10,
			},

			// Valor mínimo para aprovação
			passingGrade: {
				type: Number,
				default: 6,
			},

			// Número de casas decimais
			decimalPlaces: {
				type: Number,
				default: 1,
				min: 0,
				max: 2,
			},

			// Se permite valores fracionados
			allowFractions: {
				type: Boolean,
				default: true,
			},
		},

		// Configuração do sistema conceitual
		conceptualConfig: {
			// Conceitos disponíveis (do melhor para o pior)
			concepts: [{
				symbol: String,     // Ex: "A", "B", "C", "D", "E"
				description: String, // Ex: "Excelente", "Bom", "Regular"
				minValue: Number,    // Valor numérico mínimo equivalente
				maxValue: Number,    // Valor numérico máximo equivalente
				passing: Boolean,    // Se este conceito é aprovativo
			}],
		},

		// Configuração do sistema descritivo
		descriptiveConfig: {
			// Categorias de avaliação
			categories: [{
				name: String,        // Ex: "Participação", "Compreensão"
				weight: Number,      // Peso da categoria
				description: String, // Descrição da categoria
			}],

			// Níveis de desempenho
			performanceLevels: [{
				name: String,        // Ex: "Atingiu plenamente", "Atingiu parcialmente"
				value: Number,       // Valor numérico equivalente
				passing: Boolean,    // Se este nível é aprovativo
			}],
		},

		// Configuração personalizada (para sistemas específicos)
		customConfig: {
			type: Schema.Types.Mixed,
		},

		// Status do sistema de avaliação
		status: {
			type: String,
			enum: ['active', 'inactive'],
			default: 'active',
		},

		// Ano acadêmico relacionado (opcional, se for específico para um ano)
		academicYear: {
			type: Schema.Types.ObjectId,
			ref: "AcademicYear",
		},

		// Níveis de ano que utilizam este sistema (opcional)
		yearLevels: [{
			type: Schema.Types.ObjectId,
			ref: "YearLevel",
		}],

		// Segmentos educacionais que utilizam este sistema (opcional)
		educationalSegments: [{
			type: Schema.Types.ObjectId,
			ref: "EducationalSegment",
		}],
	},
	{ timestamps: true }
);

// Índices para otimizar consultas comuns
EvaluationSystemSchema.index({ school: 1, status: 1 });
EvaluationSystemSchema.index({ school: 1, type: 1 });
EvaluationSystemSchema.index({ school: 1, academicYear: 1 });

module.exports = mongoose.models.EvaluationSystem || mongoose.model('EvaluationSystem', EvaluationSystemSchema);
