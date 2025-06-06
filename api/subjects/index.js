// Subjects Router
// ./api/subjects/index.js

'use strict';

const express = require('express');
const controller = require('./subjects.controller');
const router = express.Router();
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');
const { auditCreate, auditUpdate, auditDelete } = require('../../middleware/audit.middleware');
const Subjects = require('./subjects.model');

// Listar disciplinas com filtros e paginação
router.get('/',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.listSubjects
);

// Obter detalhes de uma disciplina específica
router.get('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getSubject
);

// Criar uma nova disciplina
router.post('/',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	auditCreate('Subjects', Subjects),
	controller.createSubject
);

// Atualizar uma disciplina existente
router.put('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	auditUpdate('Subjects', Subjects),
	controller.updateSubject
);

// Excluir uma disciplina
router.delete('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin'),
	auditDelete('Subjects', Subjects),
	controller.deleteSubject
);

// Verificar pré-requisitos para um aluno
router.get('/:subjectId/prerequisites/:studentId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.checkPrerequisites
);

// Verificar aprovação de um aluno em uma disciplina
router.get('/:subjectId/approval/:studentId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.checkApproval
);

// Buscar disciplinas por tipo para um determinado nível e ano acadêmico
router.get('/type/:type/year-level/:yearLevelId/academic-year/:academicYearId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.findByTypeAndLevel
);

// Buscar estatísticas de aprovação por disciplina
router.get('/:subjectId/approval-stats',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getApprovalStats
);

// Atualizar o status de uma disciplina
router.patch('/:id/status',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin'),
	auditUpdate('Subjects', Subjects),
	controller.updateStatus
);

module.exports = router;