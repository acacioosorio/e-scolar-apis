const AWS = require('aws-sdk');
const Jimp = require("jimp");
const multer = require('multer');
const { randomUUID } = require('crypto');
const upload = multer({ storage: multer.memoryStorage() });

const slugify = require('slugify');
const School = require('./school.model')
const Users = require('../users/users.model');
const Student = require('../students/students.model')

const { logger, saveFileToS3, deleteFileFromS3 } = require('../../helpers');
const { sendValidateEmail } = require('../../helpers/emails');

/**
 * Configure Nodemailer
 */

exports.index = async (req, res, next) => {
	res.send("Schools API")
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
 */
exports.listEmployees = async (req, res, next) => {
	try {
		const schoolId = req.query.id || req.user?.school;
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		// Build filter object from query params
		const filterFields = ['firstName', 'lastName', 'email', 'role', 'active'];
		const filter = { school: schoolId };

		filterFields.forEach(field => {
			if (req.query[field]) {
				// Use case-insensitive regex for string fields
				if (['firstName', 'lastName', 'email'].includes(field)) {
					filter[field] = new RegExp(req.query[field], 'i');
				} else {
					filter[field] = req.query[field];
				}
			}
		});

		if (!schoolId) {
			return res.status(400).send({ error: 'School ID is required' });
		}

		// Check if user has permission to view employees
		if (req.user && req.user.school.toString() !== schoolId.toString() && req.user.role !== 'master') {
			return res.status(403).send({ error: 'Not authorized to view employees from this school' });
		}

		const school = await School.findById(schoolId);
		if (!school) {
			return res.status(404).send({ error: 'School not found' });
		}

		// Get total count for pagination
		const totalEmployees = await School.findById(schoolId)
			.populate({
				path: 'employees',
				match: filter,
				select: '-validateHash -password -__v'
			})
			.select('employees');

		const totalCount = totalEmployees.employees.length;
		const totalPages = Math.ceil(totalCount / limit);

		const result = await School.findById(schoolId)
			.populate({
				path: 'employees',
				match: filter,
				select: '-validateHash -password -__v',
				options: {
					skip: skip,
					limit: limit
				}
			})
			.select('employees name');

		res.status(200).send({
			employees: result.employees,
			pagination: {
				currentPage: page,
				totalPages: totalPages,
				totalItems: totalCount,
				itemsPerPage: limit
			}
		});
	} catch (error) {
		logger.error('Error in listEmployees:', error);
		if (error.name === 'CastError') {
			return res.status(400).send({ error: 'Invalid school ID format' });
		}
		res.status(500).send({ error: 'Internal server error while fetching employees' });
	}
}

/**
 * 
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
exports.addEmployee = async (req, res, next) => {

	try {
		const data = req.body;
		const schoolId = req.user?.school;

		// Generate validation hash
		const validationHash = randomUUID();
		const expirationDate = new Date();
		expirationDate.setHours(expirationDate.getHours() + 24);

		// Create new user object
		const newUser = new Users({
			...data,
			password: randomUUID(), // temporary password
			validateHash: {
				hash: validationHash,
				hashExpiration: expirationDate
			},
			active: false,
			school: schoolId
		});

		// Find school
		const school = await School.findById(newUser.school);
		if (!school) {
			return res.status(404).json({
				error: 'Escola não encontrada'
			});
		}

		// Save user
		await newUser.save();

		// Update school with new user
		await School.findByIdAndUpdate(
			school._id,
			{ $push: { employees: newUser._id } }
		);

		// Send response immediately
		res.status(201).json({
			message: 'Usuário criado com sucesso',
			user: {
				id: newUser._id,
				firstName: newUser.firstName,
				lastName: newUser.lastName,
				email: newUser.email,
				role: newUser.role,
				subRole: newUser.subRole
			}
		});

		// Send email asynchronously after response
		try {
			await sendValidateEmail(newUser, school, validationHash);
		} catch (emailError) {
			console.error('Error sending welcome email:', emailError);
			// Email error doesn't affect user creation, just log it
		}

	} catch (error) {
		logger.error('Error creating user:', error);
		res.status(500).json({
			error,
			message: 'Erro interno ao criar usuário'
		});
	}

};


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

/**
 * Updates the status of an employee
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateEmployeeStatus = async (req, res) => {
	console.log("updateEmployeeStatus body", req.body);
	console.log("updateEmployeeStatus params", req.params);

	try {
		const { id } = req.params;
		const { status } = req.body;
		const schoolId = req.user?.school;

		if (typeof status !== 'boolean') {
			return res.status(400).json({
				success: false,
				message: 'Status must be a boolean value (true/false)'
			});
		}

		// Find the user and check if they belong to the school
		const user = await Users.findOne({ _id: id, school: schoolId });
		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'User not found or does not belong to this school'
			});
		}

		// Update user status
		user.active = status;
		if (!status) {
			// If deactivating user, clear validation hash
			user.validateHash = {
				hash: null,
				hashExpiration: null
			};
		}
		await user.save();

		// Get the calculated status
		const calculatedStatus = user.status;

		// Notify connected clients about the status change via socket
		const SchoolSocketService = require('./school.socket');
		const { Server } = require('socket.io');
		const io = req.app.get('io');
		if (io) {
			await SchoolSocketService.notifyUserStatusChange(io, schoolId, id, calculatedStatus);
		}

		res.json({
			success: true,
			data: {
				message: `Collaborator status updated to ${calculatedStatus}`,
				status: calculatedStatus
			}
		});

	} catch (error) {
		logger.error('Error updating user status:', error);
		res.status(500).json({
			success: false,
			message: 'Error updating user status',
			error: error.message
		});
	}
};

/**
 * Updates an employee's information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateEmployee = async (req, res) => {
	try {
		const updates = req.body;
		const schoolId = req.user?.school;

		console.log("updateEmployee body", req.body);

		// Fields that cannot be updated
		const restrictedFields = ['password', 'role', 'school', 'validateHash', 'active'];
		restrictedFields.forEach(field => delete updates[field]);

		// Find the user and check if they belong to the school
		const user = await Users.findOne({ _id: updates._id, school: schoolId });
		if (!user) {
			return res.status(404).json({
				success: false,
				message: 'User not found or does not belong to this school'
			});
		}

		// Update user information
		const updatedUser = await Users.findByIdAndUpdate(
			updates._id,
			{ $set: updates },
			{ 
				new: true,
				select: '-password -validateHash'
			}
		);

		// Get the calculated status
		const calculatedStatus = updatedUser.status;

		res.json({
			success: true,
			message: 'Employee updated successfully',
			data: {
				...updatedUser.toJSON(),
				status: calculatedStatus
			}
		});

	} catch (error) {
		logger.error('Error updating employee:', error);
		res.status(500).json({
			success: false,
			message: 'Error updating employee',
			error: error.message
		});
	}
};

exports.resendUserActivation = async (req, res) => {
	try {
		const { id } = req.params;
		const requestingUser = req.user;

		// Find the user and populate school
		const user = await Users.findById(id).populate('school');
		
		if (!user) {
			return res.status(404).json({ error: 'Usuário nao encontrado.' });
		}

		// Compare school IDs as strings to ensure proper comparison
		if (user.school._id.toString() !== requestingUser.school.toString()) {
			return res.status(403).json({ 
				error: 'Sem permissão para reenviar ativação para usuários de outras escolas.' 
			});
		}

		// Check if user is already active
		if (user.active && !user.validateHash.hash) {
			return res.status(400).json({ error: 'Usuário já está ativo.' });
		}

		// Generate new validation hash
		const validationHash = randomUUID();
		const expirationDate = new Date();
		expirationDate.setHours(expirationDate.getHours() + 24);

		// Update user with new validation hash
		user.validateHash = {
			hash: validationHash,
			hashExpiration: expirationDate
		};
		await user.save();

		// Send response immediately
		res.status(200).json({
			message: 'Email de ativação reenviado com sucesso',
			user: {
				id: user._id,
				firstName: user.firstName,
				lastName: user.lastName,
				email: user.email
			}
		});

		try {
			await sendValidateEmail(user, user.school, validationHash);
		} catch (emailError) {
			// Email error doesn't affect the response since we already sent success
			logger.error('Error sending activation email:', emailError);
		}

	} catch (error) {
		logger.error('Error resending activation:', error);
		res.status(500).json({
			error: 'Erro interno ao reenviar email de ativação'
		});
	}
};