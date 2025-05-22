// Attendance Router
// ./api/attendance/index.js

'use strict';

const express = require('express');
const controller = require('./subjects.controller');
const router = express.Router();
const passport = require('passport');
const { authorizeRoles, authorizeSubRoles } = require('../../middleware/auth');

module.exports = router;
