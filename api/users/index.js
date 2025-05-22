// Users Router
// ./api/users/index.js

'use strict';

const express = require('express');
const controller = require('./users.controller');
const passport = require('passport')

const router = express.Router();

router.get('/', controller.index);
router.get('/teste', passport.authenticate('jwt-user', { session: false }), controller.teste);
router.get('/me', passport.authenticate('jwt-user', { session: false }), controller.me)

router.post('/signup', controller.signup);
router.post('/signin', controller.signin);

module.exports = router;