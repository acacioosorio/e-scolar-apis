const AWS = require('aws-sdk');
const Jimp = require("jimp");
const multer = require('multer');
const { randomUUID } = require('crypto');
const upload = multer({ storage: multer.memoryStorage() });

const slugify = require('slugify');
const School = require('./school.model')
const Student = require('../students/students.model')
// const Employee = require('../employee/employee.model')
const { Segments, YearLevel } = require('./segments.model')

const { logger, saveFileToS3, deleteFileFromS3 } = require('../../helpers');
const { sendValidateEmail } = require('../../helpers/emails');

/**
 * Configure Nodemailer
 */
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
	host: "smtp.kinghost.net",
	port: 465,
	secure: true,
	auth: {
		user: "admin@escolar.site",
		pass: "Ac410s0#789852",
	},
	// auth: {
	// 	user: "noreply@escolar.site",
	// 	pass: "eSc789@4A58B4#123!4s",
	// },
});

exports.index = async (req, res, next) => {
	res.send("Schools API")

	const info = await transporter.sendMail({
		from: '"E-scolar" <admin@escolar.site>',
		to: 'acaciodoug+03@gmail.com',
		subject: "Sua conta foi criada no E-scolar 🤝",
		text: `Olá Fulano, como vai? Uma conta foi criada para você na instituição Chupetinha. Para ativar a sua conta e configurar a sua senha, acesso o link https://escolar.site/validate-account?AASDASDASD. Em caso de dúvidas, não deixe de entrar em contato, blablablabla...`,
		html: `
		<!DOCTYPE html>
		<html>

			<head>
				<title>Complete Your Registration</title>
			</head>

			<body style="padding:20px">
				<div class="card" style="background-clip:border-box; background-color:#fff; border:0 solid #dfe3e7; border-radius:0.267rem; display:flex; flex-direction:column; min-width:0; position:relative; word-wrap:break-word" bgcolor="#ffffff">
					<div class="card-header" style="border:none; padding-bottom:22.4px; padding-left:27.2px; padding-right:27.2px; padding-top:22.4px">
						<h4 style="font-size:1.2rem; margin:0">Final Step to Activate Your Account</h4>
					</div>
					<div class="card-body" style="flex:1 1 auto; padding:1rem">
						<p>Dear Churros,</p>
						<p>Thank you for signing up with us! You're just one step away from activating your account.</p>
						<p>To complete your registration, please set up your password. This will ensure your account is secure and
							ready to use.</p>
						<a href="http://localhost:3000/auth/validate-account?hash=AASASDASDASDASDASD&email=ASDASD@asedasd.com" class="btn btn-primary" style="margin: 16px 0; -moz-user-select:none; -ms-user-select:none; -webkit-user-select:none; background-color:#5a8dee; border:1px solid transparent; border-radius:0.267rem; color:#fff; cursor:pointer; display:inline-block; font-size:0.855rem; font-weight:400; line-height:1.5; padding:0.467rem 1.5rem; text-align:center; text-decoration:none; transition:color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out; user-select:none; vertical-align:middle; border-color:#5a8dee" bgcolor="#5a8dee" align="center" valign="middle">Set Your
							Password</a>
						<p>Once your password is set, your account will be fully activated, and you'll gain full access to all our
							features and services.</p>
						<p>If you have any questions or need assistance, feel free to reach out to our support team.</p>
						<p>Thank you for choosing us!</p>
						<p>Best regards,<br>Chupetinha</p>
					</div>
				</div>
			</body>

		</html>
		`,
	}, function (error, info) {
		if (error) {
			console.log(error);
		}
		console.log(info);
	});

};

/**
 * Creates a new school.
 * 
 * @param {Object} req - The request object containing the files and name of the school.
 * @param {Object} res - The response object used to send a response to the client.
 * @param {Function} next - The next function to be called in the middleware chain.
 * @returns {Promise<void>} - A promise that resolves when the school is created.
 */
exports.create = async (req, res, next) => {
	let s3TempKeys = [];

	try {
		const { files } = req;
		const folder = str2slug(req.body.name);

		for (const file of files) {
			const savedFile = await saveFileToS3(file.buffer, file.mimetype, folder);
			s3TempKeys.push(savedFile.Key); // Store keys for potential cleanup

			if (files.indexOf(file) === 0) req.body.logo = savedFile.Location;
			else req.body.facade = savedFile.Location;
		}

		delete req.body.files;
		req.body.active = true;

		const newSchool = new School(req.body);
		await newSchool.save();

		res.status(200).send({ newSchool });
	} catch (error) {
		logger.error(error);

		for (const key of s3TempKeys) await deleteFileFromS3(key); // Cleanup S3 on error

		res.status(500).send({ error: error });
	}
};

/**
 * Retrieves a list of schools with their employees.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {Promise} A promise that resolves to the list of schools with their employees.
 * @throws {Error} If there is an error retrieving the schools or populating the employees.
 */
exports.listSchools = async (req, res, next) => {
	try {
		const schools = await School.find().populate('employees');
		res.status(200).send({ schools });
	} catch (error) {
		logger.error(error);
		res.status(500).send({ error: error });
	}
}

/**
 * Retrieves a list of employees for a school.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {Promise} - A promise that resolves to the list of employees for the school.
 * @throws {Error} - If there is an error retrieving the list of employees.
 */
exports.listEmployees = async (req, res, next) => {
	
	const schoolId = req.query.id || req.user.school;

	try {
		const school = await School.findById(schoolId).populate('employees').select('employees email slug name logo facade telephone email CNPJ location');
		res.status(200).send({ school });
	} catch (error) {
		logger.error(error);
		res.status(500).send({ error: error });
	}
}

/**
 * 
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
exports.addUser = async (req, res, next) => {

	const data = req.body;

	const newEmployee = {
		...data,
		password: randomUUID(),
		validateHash: {
			hash: '',
			hashExpiration: ''
		}
	};

	try {

		if (newEmployee.role === "master") res.status(500).send({ message: 'Cant create a Master role' });

		const validationHash = randomUUID();
		const expirationDate = new Date();
		expirationDate.setHours(expirationDate.getHours() + 24);

		newEmployee.validateHash.hash = validationHash;
		newEmployee.validateHash.hashExpiration = expirationDate;

		const school = await School.findById(data.school);

		const info = await transporter.sendMail({
			from: '"E-scolar" <admin@escolar.site>',
			to: newEmployee.email,
			subject: "Sua conta foi criada no E-scolar 🤝",
			text: `Olá ${newEmployee.firstName}, como vai? Uma conta foi criada para você na instituição ${school.name}. Para ativar a sua conta e configurar a sua senha, acesso o link https://escolar.site/validate-account?${validationHash}. Em caso de dúvidas, não deixe de entrar em contato, blablablabla...`,
			html: `
			<!DOCTYPE html>
			<html>

				<head>
					<title>Complete Your Registration</title>
				</head>

				<body style="padding:20px">
					<div class="card" style="background-clip:border-box; background-color:#fff; border:0 solid #dfe3e7; border-radius:0.267rem; display:flex; flex-direction:column; min-width:0; position:relative; word-wrap:break-word" bgcolor="#ffffff">
						<div class="card-header" style="border:none; padding-bottom:22.4px; padding-left:27.2px; padding-right:27.2px; padding-top:22.4px">
							<h4 style="font-size:1.2rem; margin:0">Final Step to Activate Your Account</h4>
						</div>
						<div class="card-body" style="flex:1 1 auto; padding:1rem">
							<p>Dear ${data.firstName},</p>
							<p>Thank you for signing up with us! You're just one step away from activating your account.</p>
							<p>To complete your registration, please set up your password. This will ensure your account is secure and
								ready to use.</p>
							<a href="http://localhost:3000/auth/validate-account?hash=${validationHash}&email=${data.email}" class="btn btn-primary" style="margin: 16px 0; -moz-user-select:none; -ms-user-select:none; -webkit-user-select:none; background-color:#5a8dee; border:1px solid transparent; border-radius:0.267rem; color:#fff; cursor:pointer; display:inline-block; font-size:0.855rem; font-weight:400; line-height:1.5; padding:0.467rem 1.5rem; text-align:center; text-decoration:none; transition:color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out; user-select:none; vertical-align:middle; border-color:#5a8dee" bgcolor="#5a8dee" align="center" valign="middle">Set Your
								Password</a>
							<p>Once your password is set, your account will be fully activated, and you'll gain full access to all our
								features and services.</p>
							<p>If you have any questions or need assistance, feel free to reach out to our support team.</p>
							<p>Thank you for choosing us!</p>
							<p>Best regards,<br>${data.school.name}</p>
						</div>
					</div>
				</body>

			</html>
			`,
		});

		const employee = new Employee(newEmployee);
		await employee.save();

		const updatedEmployee = await School.findOneAndUpdate(
			{ _id: data.school },
			{ $push: { employees: employee._id } },
			{ new: true }
		);

		res.status(200).send(updatedEmployee);
		
	} catch (error) {
		logger.error(error)
		// console.log("Line 99", error.message);
		res.status(500).send({ error: error });
	}

};

/**
 * 
 */
exports.listSegments = async (req, res, next) => {
	const user = req.user;
	const body = req.body;

	try {
		const response = await School.findById(user.school).populate('segments');
		return res.status(200).send(response)
	} catch (error) {
		logger.error(error)
		res.status(500).send({ error: error });
	}
}

/**
 * 
 */
exports.createSegment = async (req, res, next) => {
	const user = req.user;
	const body = req.body;

	try {
		const newSegment = new Segments(body);
		let response = await newSegment.save();

		const updatedSchool = await School.findByIdAndUpdate(user.school,
			{ $push: { segments: response._id } },
			{ new: true, safe: true, upsert: false }
		);

		return res.status(200).send({updatedSchool})

	} catch (error) {
		logger.error(error)
		res.status(500).send({ error: error });
	}
	
}

/**
 * 
 */
exports.updateSegment = async (req, res, next) => {
	const user = req.user;
	const body = req.body;

	try {
		const existingEdStage = await Segments.findById(body._id);
		if (existingEdStage) {
			const update = Object.keys(body).reduce((acc, key) => {
                if (existingEdStage[key] !== body[key]) {
                    acc[key] = body[key];
                }
                return acc;
            }, {});

			const updatedSegment = await Segments.findByIdAndUpdate(body._id, update, { new: true });
			return res.status(200).send(updatedSegment)
		}

	} catch (error) {
		logger.error(error)
		res.status(500).send({ error: error });
	}
	
}

/**
 * Get school statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSchoolStats = async (req, res) => {
	try {
		const schoolId = req.user.school;
		const school = await School.findById(schoolId)
			.populate('students')
			.populate('employees')
			.populate('responsiblesApproved')
			.lean();

		if (!school) {
			return res.status(404).json({
				success: false,
				message: 'School not found'
			});
		}

		const stats = {
			totalStudents: school.students.length,
			totalEmployees: school.employees.length,
			totalResponsibles: school.responsiblesApproved.length,
			pendingResponsibles: school.responsiblesWaiting.length,
			studentsByState: school.students.reduce((acc, student) => {
				const state = student.location?.state;
				if (state) {
					acc[state] = (acc[state] || 0) + 1;
				}
				return acc;
			}, {}),
			activeStatus: school.active,
			location: {
				city: school.location.city,
				state: school.location.state
			}
		};

		res.status(200).json({
			success: true,
			data: stats
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: 'Error fetching school statistics',
			error: error.message
		});
	}
};

/**
 * Get aggregated statistics for all schools
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getGlobalSchoolStats = async (req, res) => {
	try {
		const stats = await School.aggregate([
			{
				$facet: {
					totalSchools: [{ $count: 'count' }],
					activeSchools: [
						{ $match: { active: true } },
						{ $count: 'count' }
					],
					studentDistribution: [
						{ $project: { studentCount: { $size: '$students' } } },
						{
							$group: {
								_id: null,
								totalStudents: { $sum: '$studentCount' },
								avgStudentsPerSchool: { $avg: '$studentCount' },
								maxStudents: { $max: '$studentCount' },
								minStudents: { $min: '$studentCount' }
							}
						}
					],
					schoolsByState: [
						{
							$group: {
								_id: '$location.state',
								count: { $sum: 1 }
							}
						}
					]
				}
			}
		]);

		res.status(200).json({
			success: true,
			data: stats[0]
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: 'Error fetching global school statistics',
			error: error.message
		});
	}
};