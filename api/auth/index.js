'use strict';

const express = require('express');
const controller = require('./auth.controller');
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

var router = express.Router();

router.post('/signup', controller.signup);
router.post('/signin', controller.signin);

router.post('/backoffice/signin', controller.backofficeSignin);
router.post('/school/singin', controller.schoolSignin);

router.get('/check-validation/:hash', controller.checkValidation);
router.post('/validation', upload.single('photo'), controller.validation);

module.exports = router;