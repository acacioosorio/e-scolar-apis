// Pedagogy Router
// ./api/pedagogy/index.js

'use strict';

const express = require('express');
const controller = require('./pedagogy.controller');
const router = express.Router();
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');

// --- Educational Segment Routes ---

// List all segments for the school
router.get('/segments',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'), // Adjust roles as needed
	controller.listSegments
);

// // Add a new segment
router.post('/segments',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'), // Only admins can create segments
	controller.addSegment
);

router.get('/segments/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'), // Only admins can get segments
	controller.getSegment
);

// Update a segment
router.put('/segments/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'), // Only admins can update segments
	controller.updateSegment
);

// Delete a segment
router.delete('/segments/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'), // Only admins can delete segments
	controller.deleteSegment
);

// GET /api/pedagogy/segments/:segmentId/year-levels
router.get(
	'/segments/:segmentId/year-levels',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff', 'teacher'),
	controller.listYearLevelsBySegment
);

// --- Year Level Routes ---

// List all year levels
router.get('/year-levels',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	controller.listYearLevels
);

// Add a new year level
router.post('/year-levels',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	controller.addYearLevel
);

// Get a year level
router.get('/year-levels/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	controller.getYearLevel
);

// Update a year level
router.put('/year-levels/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	controller.updateYearLevel
);

// Delete a year level
router.delete('/year-levels/:id',
	passport.authenticate('jwt-user', { session: false }),
	authorizeRoles('backoffice', 'school'),
	authorizeSubRoles('admin', 'staff'),
	controller.deleteYearLevel
);

module.exports = router;