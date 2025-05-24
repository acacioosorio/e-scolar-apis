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

// Listar notas com filtros e paginação
router.get('/',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher', 'parent', 'student'),
	controller.listMarks
);

// Obter detalhes de uma nota específica
router.get('/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher', 'parent', 'student'),
	controller.getMark
);

// Criar nova nota
router.post('/',
	passport.authenticate('jwt-user', { session: false }),
	auditCreate('Marks', Marks),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher'),
	controller.createMark
);

// Gerar boletim de um aluno
router.get('/report/:studentId/:classId',
	passport.authenticate('jwt-user', { session: false }),
	auditCreate('Marks', Marks),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher'),
	controller.generateStudentReport
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
router.get('/average/:studentId/:subjectId/:classId/:evaluationPeriod?',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher', 'parent', 'student'),
	controller.calculateAverage
);

// Verificar aprovação de um aluno em uma disciplina
router.get('/approval/:studentId/:subjectId/:classId',
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
	controller.generateStudentReport
);

// Gerar relatório de desempenho da turma
router.get('/class-report/:classId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher'),
	controller.generateClassReport
);

// Obter estatísticas de desempenho para uma disciplina
router.get('/statistics/subject/:subjectId/:academicYearId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher'),
	controller.getSubjectStatistics
);

// Importar notas em lote
router.get('/statistics/subject/:subjectId/:academicYearId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher'),
	controller.bulkImport
);

module.exports = router;
