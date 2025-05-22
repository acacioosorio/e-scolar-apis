// Evaluation System Controller
// /api/evaluation-systems/evaluationSystem.controller.js

const mongoose = require('mongoose');
const EvaluationSystem = require('./evaluationSystem.model');
const YearLevel = mongoose.model('YearLevel');
const EducationalSegment = mongoose.model('EducationalSegment');
const { createErrorResponse } = require('../../helpers');

/**
 * Cria um novo sistema de avaliação
 */
exports.createEvaluationSystem = async (req, res, next) => {
	try {
		// Adicionar a escola do usuário logado
		req.body.school = req.user.school;

		// Validar configuração com base no tipo
		const { type } = req.body;

		if (type === 'numeric' && !req.body.numericConfig) {
			return res.status(400).json(createErrorResponse('Configuração numérica é obrigatória para sistemas do tipo numérico'));
		}

		if (type === 'conceptual' && (!req.body.conceptualConfig || !req.body.conceptualConfig.concepts || !req.body.conceptualConfig.concepts.length)) {
			return res.status(400).json(createErrorResponse('Configuração conceitual com conceitos é obrigatória para sistemas do tipo conceitual'));
		}

		if (type === 'descriptive' && (!req.body.descriptiveConfig || !req.body.descriptiveConfig.performanceLevels || !req.body.descriptiveConfig.performanceLevels.length)) {
			return res.status(400).json(createErrorResponse('Configuração descritiva com níveis de desempenho é obrigatória para sistemas do tipo descritivo'));
		}

		// Criar o sistema de avaliação
		const evaluationSystem = await EvaluationSystem.create(req.body);

		return res.status(201).json({
			success: true,
			data: evaluationSystem
		});
	} catch (err) { next(err); }
};

/**
 * Obtém todos os sistemas de avaliação da escola
 */
exports.getEvaluationSystems = async (req, res, next) => {
	try {
		const { type, status, academicYear, yearLevel, educationalSegment } = req.query;

		// Construir filtro
		const filter = {
			school: req.user.school
		};

		// Filtros opcionais
		if (type) filter.type = type;
		if (status) filter.status = status;
		if (academicYear) filter.academicYear = academicYear;
		if (yearLevel) filter.yearLevels = yearLevel;
		if (educationalSegment) filter.educationalSegments = educationalSegment;

		// Buscar sistemas de avaliação
		const evaluationSystems = await EvaluationSystem.find(filter)
			.populate('academicYear', 'name')
			.populate('yearLevels', 'name')
			.populate('educationalSegments', 'name');

		return res.status(200).json({
			success: true,
			count: evaluationSystems.length,
			data: evaluationSystems
		});
	} catch (err) { next(err); }
};

/**
 * Obtém um sistema de avaliação específico
 */
exports.getEvaluationSystem = async (req, res, next) => {
	try {
		const evaluationSystem = await EvaluationSystem.findById(req.params.id)
			.populate('academicYear', 'name')
			.populate('yearLevels', 'name')
			.populate('educationalSegments', 'name');

		if (!evaluationSystem) {
			return res.status(404).json(createErrorResponse('Sistema de avaliação não encontrado'));
		}

		// Verificar se o usuário pertence à escola do sistema
		if (evaluationSystem.school.toString() !== req.user.school.toString()) {
			return res.status(403).json(createErrorResponse('Você não tem permissão para acessar este sistema de avaliação'));
		}

		return res.status(200).json({
			success: true,
			data: evaluationSystem
		});
	} catch (err) { next(err); }
};

/**
 * Atualiza um sistema de avaliação
 */
exports.updateEvaluationSystem = async (req, res, next) => {
	try {
		let evaluationSystem = await EvaluationSystem.findById(req.params.id);

		if (!evaluationSystem) {
			return res.status(404).json(createErrorResponse('Sistema de avaliação não encontrado'));
		}

		// Verificar se o usuário pertence à escola do sistema
		if (evaluationSystem.school.toString() !== req.user.school.toString()) {
			return res.status(403).json(createErrorResponse('Você não tem permissão para atualizar este sistema de avaliação'));
		}

		// Não permitir alterar a escola
		delete req.body.school;

		// Validar configuração com base no tipo
		const type = req.body.type || evaluationSystem.type;

		if (type === 'numeric' && req.body.numericConfig === undefined && !evaluationSystem.numericConfig) {
			return res.status(400).json(createErrorResponse('Configuração numérica é obrigatória para sistemas do tipo numérico'));
		}

		if (type === 'conceptual' && req.body.conceptualConfig === undefined &&
			(!evaluationSystem.conceptualConfig || !evaluationSystem.conceptualConfig.concepts || !evaluationSystem.conceptualConfig.concepts.length)) {
			return res.status(400).json(createErrorResponse('Configuração conceitual com conceitos é obrigatória para sistemas do tipo conceitual'));
		}

		if (type === 'descriptive' && req.body.descriptiveConfig === undefined &&
			(!evaluationSystem.descriptiveConfig || !evaluationSystem.descriptiveConfig.performanceLevels || !evaluationSystem.descriptiveConfig.performanceLevels.length)) {
			return res.status(400).json(createErrorResponse('Configuração descritiva com níveis de desempenho é obrigatória para sistemas do tipo descritivo'));
		}

		// Atualizar o sistema de avaliação
		evaluationSystem = await EvaluationSystem.findByIdAndUpdate(
			req.params.id,
			req.body,
			{
				new: true,
				runValidators: true
			}
		);

		return res.status(200).json({
			success: true,
			data: evaluationSystem
		});
	} catch (err) { next(err); }
};

/**
 * Desativa um sistema de avaliação
 */
exports.deactivateEvaluationSystem = async (req, res, next) => {
	try {
		let evaluationSystem = await EvaluationSystem.findById(req.params.id);

		if (!evaluationSystem) {
			return res.status(404).json(createErrorResponse('Sistema de avaliação não encontrado'));
		}

		// Verificar se o usuário pertence à escola do sistema
		if (evaluationSystem.school.toString() !== req.user.school.toString()) {
			return res.status(403).json(createErrorResponse('Você não tem permissão para desativar este sistema de avaliação'));
		}

		// Desativar o sistema
		evaluationSystem = await EvaluationSystem.findByIdAndUpdate(
			req.params.id,
			{ status: 'inactive' },
			{ new: true }
		);

		return res.status(200).json({
			success: true,
			data: evaluationSystem
		});
	} catch (err) { next(err); }
};

/**
 * Converte uma nota para o formato do sistema de avaliação
 */
exports.convertGrade = async (req, res, next) => {
	try {
		const { systemId, value } = req.body;

		if (!systemId || value === undefined) {
			return res.status(400).json(createErrorResponse('ID do sistema e valor são obrigatórios'));
		}

		// Buscar o sistema de avaliação
		const evaluationSystem = await EvaluationSystem.findById(systemId);

		if (!evaluationSystem) {
			return res.status(404).json(createErrorResponse('Sistema de avaliação não encontrado'));
		}

		// Verificar se o usuário pertence à escola do sistema
		if (evaluationSystem.school.toString() !== req.user.school.toString()) {
			return res.status(403).json(createErrorResponse('Você não tem permissão para acessar este sistema de avaliação'));
		}

		// Converter a nota
		let numericValue = parseFloat(value);

		// Se não for um número, tentar converter de conceito para número
		if (isNaN(numericValue)) {
			if (evaluationSystem.type === 'conceptual' && evaluationSystem.conceptualConfig?.concepts?.length > 0) {
				const concept = evaluationSystem.conceptualConfig.concepts.find(c => c.symbol === value);
				if (concept) {
					// Retornar o valor médio do intervalo do conceito
					numericValue = (concept.minValue + concept.maxValue) / 2;
				}
			} else if (evaluationSystem.type === 'descriptive' && evaluationSystem.descriptiveConfig?.performanceLevels?.length > 0) {
				const level = evaluationSystem.descriptiveConfig.performanceLevels.find(l => l.name === value);
				if (level) {
					numericValue = level.value;
				}
			}
		}

		if (isNaN(numericValue)) {
			return res.status(400).json(createErrorResponse('Valor inválido para conversão'));
		}

		// Formatar a nota de acordo com o sistema
		let convertedGrade;

		// Arredondar para o número de casas decimais configurado
		const decimalPlaces = evaluationSystem.numericConfig?.decimalPlaces || 1;
		const roundedValue = parseFloat(numericValue.toFixed(decimalPlaces));

		// Se for sistema numérico, retornar o valor arredondado
		if (evaluationSystem.type === 'numeric') {
			convertedGrade = {
				value: roundedValue,
				display: roundedValue.toString(),
				passing: roundedValue >= evaluationSystem.numericConfig.passingGrade
			};
		}
		// Se for sistema conceitual, converter para o conceito correspondente
		else if (evaluationSystem.type === 'conceptual' && evaluationSystem.conceptualConfig?.concepts?.length > 0) {
			// Encontrar o conceito correspondente ao valor numérico
			const concept = evaluationSystem.conceptualConfig.concepts.find(
				c => numericValue >= c.minValue && numericValue <= c.maxValue
			);

			if (concept) {
				convertedGrade = {
					value: numericValue,
					display: concept.symbol,
					description: concept.description,
					passing: concept.passing
				};
			}
		}
		// Se for sistema descritivo, retornar o nível de desempenho correspondente
		else if (evaluationSystem.type === 'descriptive' && evaluationSystem.descriptiveConfig?.performanceLevels?.length > 0) {
			// Encontrar o nível de desempenho mais próximo
			let closestLevel = null;
			let minDifference = Infinity;

			for (const level of evaluationSystem.descriptiveConfig.performanceLevels) {
				const difference = Math.abs(numericValue - level.value);
				if (difference < minDifference) {
					minDifference = difference;
					closestLevel = level;
				}
			}

			if (closestLevel) {
				convertedGrade = {
					value: numericValue,
					display: closestLevel.name,
					passing: closestLevel.passing
				};
			}
		}

		// Caso não encontre correspondência ou seja um sistema personalizado
		if (!convertedGrade) {
			convertedGrade = {
				value: numericValue,
				display: numericValue.toString(),
				passing: numericValue >= (evaluationSystem.numericConfig?.passingGrade || 6)
			};
		}

		return res.status(200).json({
			success: true,
			data: {
				original: value,
				numeric: numericValue,
				converted: convertedGrade
			}
		});
	} catch (err) { next(err); }
};

/**
 * Obtém o sistema de avaliação para uma disciplina específica
 */
exports.getSystemForSubject = async (req, res, next) => {
	try {
		const { subjectId, yearLevelId, academicYearId } = req.params;

		// Buscar o nível de ano para obter o segmento educacional
		const yearLevel = await YearLevel.findById(yearLevelId);

		if (!yearLevel) {
			return res.status(404).json(createErrorResponse('Nível de ano não encontrado'));
		}

		// Verificar se o usuário pertence à escola
		if (yearLevel.school.toString() !== req.user.school.toString()) {
			return res.status(403).json(createErrorResponse('Você não tem permissão para acessar este nível de ano'));
		}

		// Buscar sistema de avaliação na seguinte ordem de prioridade:
		// 1. Específico para a disciplina, nível de ano e ano acadêmico
		// 2. Específico para o nível de ano e ano acadêmico
		// 3. Específico para o segmento educacional e ano acadêmico
		// 4. Sistema padrão da escola para o ano acadêmico

		// Tentar encontrar sistema específico para a disciplina
		let evaluationSystem = await EvaluationSystem.findOne({
			school: req.user.school,
			status: 'active',
			academicYear: academicYearId,
			yearLevels: yearLevelId,
			'customConfig.subjectId': subjectId
		});

		// Se não encontrar, tentar para o nível de ano
		if (!evaluationSystem) {
			evaluationSystem = await EvaluationSystem.findOne({
				school: req.user.school,
				status: 'active',
				academicYear: academicYearId,
				yearLevels: yearLevelId
			});
		}

		// Se não encontrar, tentar para o segmento educacional
		if (!evaluationSystem && yearLevel.educationalSegment) {
			evaluationSystem = await EvaluationSystem.findOne({
				school: req.user.school,
				status: 'active',
				academicYear: academicYearId,
				educationalSegments: yearLevel.educationalSegment
			});
		}

		// Se não encontrar, usar o sistema padrão da escola
		if (!evaluationSystem) {
			evaluationSystem = await EvaluationSystem.findOne({
				school: req.user.school,
				status: 'active',
				academicYear: academicYearId,
				yearLevels: { $exists: false },
				educationalSegments: { $exists: false },
				'customConfig.subjectId': { $exists: false }
			});
		}

		// Se ainda não encontrar, usar qualquer sistema ativo da escola
		if (!evaluationSystem) {
			evaluationSystem = await EvaluationSystem.findOne({
				school: req.user.school,
				status: 'active'
			});
		}

		if (!evaluationSystem) {
			return res.status(404).json(createErrorResponse('Nenhum sistema de avaliação encontrado para esta disciplina'));
		}

		return res.status(200).json({
			success: true,
			data: evaluationSystem
		});
	} catch (err) { next(err); }
};

module.exports = exports;
