// Enrollment Router
// ./api/enrollment/index.js

'use strict';

const express = require('express');
const controller = require('./enrollment.controller');
const router = express.Router();
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');
const { auditCreate, auditUpdate, auditDelete } = require('../../middleware/audit.middleware');
const Enrollment = require('./enrollment.model');

// Listar matrículas com filtros e paginação
router.get('/',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.listEnrollments
);

// Obter detalhes de uma matrícula específica
router.get('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getEnrollment
);

// Criar uma nova matrícula
router.post('/',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	auditCreate('Enrollment', Enrollment),
	controller.createEnrollment
);

// Atualizar uma matrícula existente
router.put('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	auditUpdate('Enrollment', Enrollment),
	controller.updateEnrollment
);

// Atualizar o status de uma matrícula
router.patch('/:id/status',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	auditUpdate('Enrollment', Enrollment),
	controller.updateStatus
);

// Excluir uma matrícula
router.delete('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin'),
	auditDelete('Enrollment', Enrollment),
	controller.deleteEnrollment
);

// Listar matrículas por aluno
router.get('/student/:studentId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.listByStudent
);

// Listar matrículas por turma
router.get('/class/:classId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.listByClass
);

// Listar matrículas por ano acadêmico
router.get('/academic-year/:academicYearId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.listByAcademicYear
);

// Verificar pré-requisitos para matrícula
router.get('/prerequisites/:studentId/:classId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.checkPrerequisites
);

// Obtém as disciplinas associadas a uma matrícula
router.get('/:id/subjects',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.getEnrollmentSubjects
);

// Atualiza o status de múltiplas matrículas
router.post('/bulk-status-update',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	auditUpdate('Enrollment', Enrollment),
	controller.bulkUpdateStatus
);

module.exports = router;