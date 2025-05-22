// Evaluation Systems Router
// /api/evaluation-systems/index.js

'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./evaluationSystem.controller');
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');
const { auditCreate, auditUpdate, auditDelete } = require('../../middleware/audit.middleware');
const EvaluationSystem = require('./evaluationSystem.model');

// Listar todos os sistemas de avaliação
router.get('/',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getEvaluationSystems
);

// Criar novo sistema de avaliação
router.post('/',
	passport.authenticate('jwt-user', { session: false }),
	auditCreate('EvaluationSystem', EvaluationSystem),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin'),
	controller.createEvaluationSystem
);

// Obter sistema de avaliação específico
router.get('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getEvaluationSystem
);

// Atualizar sistema de avaliação
router.put('/:id',
	passport.authenticate('jwt-user', { session: false }),
	auditUpdate('EvaluationSystem', EvaluationSystem),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin'),
	controller.updateEvaluationSystem
);

// Desativar sistema de avaliação
router.patch('/:id/deactivate',
	passport.authenticate('jwt-user', { session: false }),
	auditUpdate('EvaluationSystem', EvaluationSystem),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin'),
	controller.deactivateEvaluationSystem
);

// Converter nota para o formato do sistema
router.post('/convert',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.convertGrade
);

// Obter sistema de avaliação para uma disciplina específica
router.get('/subject/:subjectId/year-level/:yearLevelId/academic-year/:academicYearId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getSystemForSubject
);

module.exports = router;
