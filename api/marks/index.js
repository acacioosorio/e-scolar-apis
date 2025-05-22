// Marks Router
// ./api/marks/index.js

'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./marks.controller');
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');
const { auditCreate, auditUpdate, auditDelete } = require('../../middleware/audit.middleware');
const Marks = require('./marks.model');

// Listar notas com filtros
router.get('/',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher', 'parent', 'student'),
	controller.listMarks
);

// Criar nova nota
router.post('/',
	passport.authenticate('jwt-user', { session: false }),
	auditCreate('Marks', Marks),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher'),
	controller.createMark
);

// Obter nota específica
router.get('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher', 'parent', 'student'),
	controller.getMark
);

// Atualizar nota
router.put('/:id',
	passport.authenticate('jwt-user', { session: false }),
	auditUpdate('Marks', Marks),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher'),
	controller.updateMark
);

// Excluir nota
router.delete('/:id',
	passport.authenticate('jwt-user', { session: false }),
	auditDelete('Marks', Marks),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher'),
	controller.deleteMark
);

// Calcular média de um aluno em uma disciplina
router.get('/average/:studentId/:subjectId/:academicYearId/:evaluationPeriod?',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher', 'parent', 'student'),
	controller.calculateAverage
);

// Verificar aprovação de um aluno em uma disciplina
router.get('/approval/:studentId/:subjectId/:academicYearId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher', 'parent', 'student'),
	controller.checkApproval
);

// Gerar boletim de um aluno
router.get('/report/:studentId/:academicYearId/:classId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher', 'parent', 'student'),
	controller.getStudentReport
);

// Obter estatísticas de desempenho para uma turma
router.get('/statistics/class/:classId/:academicYearId/:subjectId?',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher'),
	controller.getClassStatistics
);

// Obter estatísticas de desempenho para uma disciplina
router.get('/statistics/subject/:subjectId/:academicYearId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher'),
	controller.getSubjectStatistics
);

module.exports = router;
