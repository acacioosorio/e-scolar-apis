// Middleware para atualização automática do progresso acadêmico
// /middleware/academicProgress.middleware.js

const mongoose = require('mongoose');

/**
 * Middleware para atualizar automaticamente o progresso acadêmico
 * quando novas notas são registradas ou atualizadas
 * 
 * Este middleware intercepta as requisições POST e PUT para a API de notas
 * e dispara a atualização do progresso acadêmico do aluno em background
 */
module.exports = async function updateAcademicProgressMiddleware(req, res, next) {
	// Armazenar a resposta original
	const originalSend = res.send;

	res.send = function (data) {
		// Restaurar o método original
		res.send = originalSend;

		// Se a operação foi bem-sucedida e envolve notas (POST ou PUT)
		if ((req.method === 'POST' || req.method === 'PUT') && res.statusCode >= 200 && res.statusCode < 300) {
			try {
				const body = req.body;

				// Verificar se é uma operação relacionada a notas e tem os dados necessários
				if (body.student && body.subject && body.academicYear && body.class && body.school) {
					// Executar a atualização do progresso em background para não bloquear a resposta
					setTimeout(async () => {
						try {
							// Importar o serviço de avaliação acadêmica
							const AcademicEvaluationService = require('../api/academic-progress/academicEvaluation.service');

							// Atualizar o progresso acadêmico do aluno
							await AcademicEvaluationService.evaluateStudentProgress(
								body.student,
								body.academicYear,
								body.class,
								body.school
							);

							console.log(`Academic progress updated for student ${body.student} in subject ${body.subject}`);
						} catch (error) {
							console.error('Error updating academic progress:', error);
						}
					}, 0);
				}
			} catch (error) {
				console.error('Error in academic progress middleware:', error);
			}
		}

		// Continuar com o envio da resposta original
		return originalSend.call(this, data);
	};

	next();
};
