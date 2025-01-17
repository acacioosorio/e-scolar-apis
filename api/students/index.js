'use strict';

const express = require('express');
const controller = require('./students.controller');
const passport = require('passport');
const { authorizeRoles } = require('../../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get('/', passport.authenticate('jwt-employee', { session: false }), authorizeRoles('master', 'admin', 'teacher', 'concierge'), controller.getStudents);
router.post('/', passport.authenticate('jwt-employee', { session: false }), authorizeRoles('master', 'admin'), upload.array('files'),  controller.createStudent);
router.get('/:id', passport.authenticate('jwt-employee', { session: false }), authorizeRoles('master', 'admin', 'teacher', 'concierge'), controller.getStudent);
router.put('/:id', passport.authenticate('jwt-employee', { session: false }), authorizeRoles('master', 'admin'), upload.array('files'), controller.updateStudent);
router.delete('/:id', passport.authenticate('jwt-employee', { session: false }), authorizeRoles('master', 'admin'), controller.deleteStudent);

module.exports = router;