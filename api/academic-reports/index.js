// Academic Reports Router
// ./api/academic-reports/index.js

'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./academicReports.controller');
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');
const { auditCreate, auditUpdate, auditDelete } = require('../../middleware/audit.middleware');

// Boletim individual do aluno
// Acessível por administradores, professores e pais/responsáveis do aluno
router.get(
	'/student/:studentId/:academicYearId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher', 'parent'),
	controller.getStudentReport
);

// Relatório de desempenho da turma
// Acessível apenas por administradores e professores
router.get(
	'/class/:classId/:academicYearId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher'),
	controller.getClassReport
);

// Relatório de desempenho por disciplina
// Acessível apenas por administradores e professores
router.get(
	'/subject/:subjectId/:classId/:academicYearId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher'),
	controller.getSubjectReport
);

// Relatório de desempenho por nível de ano
// Acessível apenas por administradores
router.get(
	'/year-level/:yearLevelId/:academicYearId/:schoolId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin'),
	controller.getYearLevelReport
);

// Relatório de desempenho geral da escola
// Acessível apenas por administradores
router.get(
	'/school/:schoolId/:academicYearId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin'),
	controller.getSchoolReport
);

// Histórico de notas de um aluno em uma disciplina
router.get(
	'/student-subject-history/:studentId/:subjectId/:academicYearId',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher', 'parent', 'student'),
	controller.getStudentSubjectHistory
);

// Alunos em risco de reprovação
// Acessível apenas por administradores e professores
router.get(
	'/risk-students/:classId/:academicYearId/:threshold?',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'teacher'),
	controller.getRiskStudents
);

module.exports = router;
