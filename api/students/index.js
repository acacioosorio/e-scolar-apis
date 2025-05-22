// Students Router
// ./api/students/index.js

'use strict';

const express = require('express');
const controller = require('./students.controller');
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload only images.'), false);
        }
    }
});

const router = express.Router();

// Student management routes
router.get('/', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff', 'teacher'), 
    controller.listStudents
);

router.post('/', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'),
    upload.single('photo'),
    controller.addStudent
);

router.put('/', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'),
    upload.single('photo'),
    controller.updateStudent
);

router.delete('/:id', passport.authenticate('jwt-user', { session: false }), 
    authorizeRoles('backoffice', 'school'), 
    authorizeSubRoles('admin', 'staff'), 
    controller.deleteStudent
);

router.post(
    '/:studentId/guardians',
    passport.authenticate('jwt-user', { session: false }),
    authorizeRoles('backoffice', 'school'),
    authorizeSubRoles('admin', 'staff'),
    controller.linkResponsibles
);

router.delete(
    '/:studentId/guardians/:guardianId',
    passport.authenticate('jwt-user', { session: false }),
    authorizeRoles('backoffice', 'school'),
    authorizeSubRoles('admin', 'staff'),
    controller.unlinkResponsibles
);

router.patch(
    '/:studentId/status',
    passport.authenticate('jwt-user', { session: false }),
    authorizeRoles('backoffice', 'school'),
    authorizeSubRoles('admin', 'staff'),
    controller.updateStudentStatus
);

module.exports = router;