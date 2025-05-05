const { randomUUID } = require('crypto');
const Subjects = require('./subjects.model');
const Classes = require('../classes/classes.model');
const School = require('../schools/school.model');
const Users = require('../users/users.model');
const { logger, createErrorResponse } = require('../../helpers');
const mongoose = require('mongoose');

/**
 * List subjects with filtering, searching and pagination
 */
exports.listSubjects = async (req, res) => {
	try {
		const schoolId = req.query.id || req.user?.school;
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;
		const order = req.query.order === 'desc' ? -1 : 1;
		const searchQuery = req.query.search || '';
		const searchFields = req.query.searchFields ? req.query.searchFields.split(',') : ['name', 'description'];
		const classId = req.query.classId;

		if (!schoolId)
			return res.status(400).json(createErrorResponse('School ID is required'));

		// Check if user has permission to view subjects
		if (req.user && req.user.school.toString() !== schoolId.toString() && req.user.role !== 'master')
			return res.status(403).json(createErrorResponse('Not authorized to view subjects from this school'));

		// Verify the school exists
		const school = await School.findById(schoolId);
		if (!school)
			return res.status(404).json(createErrorResponse('School not found'));

		// Build filter object starting with school
		let filter = { school: schoolId };

		// Add search conditions if search query exists
		if (searchQuery)
			filter.$or = searchFields.map(field => ({
				[field]: new RegExp(searchQuery, 'i')
			}));

		// Add specific class filter if provided
		if (classId)
			filter.classes = classId;

		// Get total count for pagination
		const totalCount = await Subjects.countDocuments(filter);
		const totalPages = Math.ceil(totalCount / limit);

		// Get subjects with sorting and populate classes and employees
		const subjects = await Subjects.find(filter)
			.sort({ [req.query.sortBy || 'name']: order })
			.skip(skip)
			.limit(limit)
			.populate('classes', 'name')
			.populate('school', 'name')
			.populate('employees', 'firstName lastName email photo');

		res.status(200).send({
			success: true,
			data: {
				subjects,
				pagination: {
					currentPage: page,
					totalPages,
					totalItems: totalCount,
					itemsPerPage: limit,
					hasNextPage: page < totalPages,
					hasPreviousPage: page > 1
				}
			}
		});

	} catch (error) {
		logger.error('Error in listSubjects:', error);
		if (error.name === 'CastError')
			return res.status(400).json(createErrorResponse('Invalid ID format'));

		res.status(500).json(createErrorResponse('Internal server error while fetching subjects'));
	}
};

/**
 * Add a new subject
 */
exports.addSubject = async (req, res) => {
	try {
		const data = req.body;
		const schoolId = req.user?.school;

		// Validate required fields
		if (!data.name)
			return res.status(400).json(createErrorResponse('Validation error', [
				{ field: 'name', message: 'Name is required' }
			]));

		// Verify all classes belong to the school if classes are provided
		if (data.classes && data.classes.length > 0) {
			const classes = await Classes.find({
				_id: { $in: data.classes },
				school: schoolId
			});

			if (classes.length !== data.classes.length)
				return res.status(400).json(createErrorResponse('One or more classes do not belong to your school'));
		}

		// Verify all employees exist and belong to the school if provided
		if (data.employees && data.employees.length > 0) {
			const employees = await Users.find({
				_id: { $in: data.employees },
				school: schoolId,
				role: 'school',
				subRole: 'teacher'
			});

			console.log("employees", employees);

			if (employees.length !== data.employees.length)
				return res.status(400).json(createErrorResponse('One or more teachers not found or do not belong to your school'));
		}

		// Create new subject object
		const newSubject = new Subjects({
			name: data.name,
			description: data.description,
			classes: data.classes || [],
			employees: data.employees || [],
			school: schoolId
		});

		// Save subject
		await newSubject.save();

		// Populate classes, employees and school before sending response
		await newSubject.populate([
			'classes',
			{ 
				path: 'employees',
				select: 'firstName lastName email photo'
			},
			'school'
		]);

		res.status(201).json({
			success: true,
			message: 'Subject created successfully',
			data: newSubject
		});

	} catch (error) {
		logger.error('Error creating subject:', error);
		if (error.name === 'ValidationError') {
			return res.status(400).json(createErrorResponse('Validation error',
				Object.values(error.errors).map(err => ({
					field: err.path,
					message: err.message
				}))
			));
		}
		res.status(500).json(createErrorResponse('Internal error while creating subject', error.message));
	}
};

/**
 * Update subject information
 */
exports.updateSubject = async (req, res) => {
	try {
		const updates = req.body;
		const schoolId = req.user?.school;

		logger.info(`Updating subject ${updates._id} for school ${schoolId}`);

		// Find the subject and verify it belongs to the school
		const subjectToUpdate = await Subjects.findOne({
			_id: updates._id,
			school: schoolId
		});

		if (!subjectToUpdate)
			return res.status(404).json(createErrorResponse('Subject not found or does not belong to your school'));

		// If updating classes, verify they belong to the school
		if (updates.classes && updates.classes.length > 0) {
			const newClasses = await Classes.find({
				_id: { $in: updates.classes },
				school: schoolId
			});

			if (newClasses.length !== updates.classes.length)
				return res.status(400).json(createErrorResponse('One or more classes do not belong to your school'));
		}

		// If updating employees, verify they exist and are teachers in the school
		if (updates.employees && Array.isArray(updates.employees)) {
			logger.info('Validating teachers:', updates.employees);

			// First verify all IDs are valid ObjectIds
			const invalidIds = updates.employees.filter(id => !mongoose.Types.ObjectId.isValid(id));
			if (invalidIds.length > 0) {
				return res.status(400).json(createErrorResponse('Invalid teacher ID format'));
			}

			const newEmployees = await Users.find({
				_id: { $in: updates.employees },
				role: 'school',
				subRole: 'teacher'
			}).select('_id firstName lastName school role subRole');

			logger.info('Found teachers:', newEmployees);

			// Check if all teachers were found
			if (newEmployees.length !== updates.employees.length) {
				return res.status(400).json(createErrorResponse('One or more teachers not found'));
			}

			// Check if all teachers belong to the school
			const invalidTeachers = newEmployees.filter(teacher => 
				!teacher.school || teacher.school.toString() !== schoolId.toString()
			);

			if (invalidTeachers.length > 0) {
				return res.status(400).json(createErrorResponse('One or more teachers do not belong to your school'));
			}
		}

		// Remove school from updates to prevent changing it
		delete updates.school;

		// Update subject information
		const updatedSubject = await Subjects.findByIdAndUpdate(
			updates._id,
			{ $set: updates },
			{ new: true }
		).populate([
			'classes',
			{
				path: 'employees',
				select: 'firstName lastName email photo'
			},
			'school'
		]);

		res.json({
			success: true,
			message: 'Subject updated successfully',
			data: updatedSubject
		});

	} catch (error) {
		logger.error('Error updating subject:', error);
		if (error.name === 'CastError') {
			return res.status(400).json(createErrorResponse('Invalid ID format'));
		}
		if (error.name === 'ValidationError') {
			return res.status(400).json(createErrorResponse('Validation error',
				Object.values(error.errors).map(err => ({
					field: err.path,
					message: err.message
				}))
			));
		}
		res.status(500).json(createErrorResponse('Error updating subject', error.message));
	}
};

/**
 * Delete a subject
 */
exports.deleteSubject = async (req, res) => {
	try {
		const { id } = req.params;
		const schoolId = req.user?.school;

		// Find the subject and verify it belongs to the school
		const subjectToDelete = await Subjects.findOne({
			_id: id,
			school: schoolId
		}).populate(['classes', 'school']);

		if (!subjectToDelete)
			return res.status(404).json(createErrorResponse('Subject not found or does not belong to your school'));

		// Delete the subject
		await Subjects.findByIdAndDelete(id);

		return res.status(200).json({
			success: true,
			message: 'Subject deleted successfully',
			data: {
				id: subjectToDelete._id,
				name: subjectToDelete.name,
				classes: subjectToDelete.classes.map(c => ({
					id: c._id,
					name: c.name
				}))
			}
		});

	} catch (error) {
		logger.error('Delete subject error:', error);
		return res.status(500).json(createErrorResponse('Internal error while deleting subject'));
	}
};
