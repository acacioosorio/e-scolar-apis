// Classes Controller
// ./api/classes/classes.controller.js

const { randomUUID } = require('crypto');
const Classes = require('./classes.model');
const School = require('../schools/school.model');
const Subjects = require('../subjects/subjects.model');
const AcademicYear = require('../academic-years/academicYear.model');
const { logger, createErrorResponse } = require('../../helpers');
const mongoose = require('mongoose');
const EducationalSegment = require('../pedagogy/educationalSegment.model');
const YearLevel = require('../pedagogy/yearLevel.model');
const Room = require('../rooms/rooms.model');
const User = require('../users/users.model');
const Student = require('../students/students.model');
/**
 * List classes with filtering, searching and pagination
 */
exports.listClasses = async (req, res) => {
	try {
		const { academicYear, yearLevel, segment, studentId } = req.query;
		const schoolId = req.query.id || req.user?.school;

		const {
			page = parseInt(req.query.page) || 1,
			limit = parseInt(req.query.limit) || 10,
			sortBy = 'order',
			order = req.query.order === 'desc' ? -1 : 1
		} = req.query;

		const skip = (page - 1) * limit;

		const searchQuery = req.query.search || '';
		const searchFields = req.query.searchFields ? req.query.searchFields.split(',') : ['name', 'description'];

		if (!schoolId) {
			return res.status(400).json(createErrorResponse('School ID is required'));
		}

		// Check if user has permission to view classes
		if (req.user && req.user.school.toString() !== schoolId.toString() && req.user.role !== 'master') {
			return res.status(403).json(createErrorResponse('Not authorized to view classes from this school'));
		}

		const school = await School.findById(schoolId);
		if (!school) {
			return res.status(404).json(createErrorResponse('School not found'));
		}

		// Build filter object
		const filter = { school: schoolId };

		if (req.query.segment) filter.educationalSegment = req.query.segment;
		if (req.query.yearLevel) filter.yearLevel = req.query.yearLevel;
		if (req.query.shift) filter.shift = req.query.shift;

		// Update status filter to handle new enum values
		if (req.query.status) {
			if (['active', 'inactive', 'archived'].includes(req.query.status)) {
				filter.status = req.query.status;
			} else {
				return res.status(400).json(createErrorResponse('Invalid status value. Must be one of: active, disabled, archived'));
			}
		}

		// Add search conditions if search query exists
		if (searchQuery) {
			filter.$or = searchFields.map(field => ({
				[field]: new RegExp(searchQuery, 'i')
			}));
		}

		if (academicYear) filter.academicYear = academicYear;
		if (yearLevel) filter.yearLevel = yearLevel;
		if (segment) filter.educationalSegment = segment;

		// Add student filter if studentId is provided
		if (studentId) {
			// Verify if student exists and belongs to the school
			const student = await Student.findOne({ _id: studentId, school: schoolId });
			if (!student) {
				return res.status(404).json(createErrorResponse('Student not found'));
			}
			// Filter classes that contain this student
			filter._id = { $in: student.classes };
		}

		// Get total count for pagination
		const totalCount = await Classes.countDocuments(filter);
		const totalPages = Math.ceil(totalCount / limit);

		// Get classes with sorting
		const classes = await Classes.find(filter)
			.sort({ [req.query.sortBy || 'name']: order })
			.skip(skip)
			.limit(limit)
			.populate('school', 'name')
			.populate('academicYear', 'year title')
			.populate({
				path: 'yearLevel',
				select: 'name yearLevel educationalSegment',
				populate: [
					{ path: 'educationalSegment', select: 'name acronym status description' },
					{ path: 'subjects',
						select: 'name order employees',
						populate: [
							{ path: 'employees', select: 'firstName lastName email photo' },
						]
					},
				]
			})
			.populate('educationalSegment', 'name acronym')
			.populate('room', 'name capacity')
			.populate('teacherResponsible', 'firstName lastName email photo');

		// Get subjects for each class
		const classesWithSubjects = await Promise.all(classes.map(async cls => {
			const subs = await Subjects.find({
				classes: cls._id,
				school: schoolId
			}).select('name description')
				.populate('employees', 'firstName lastName email photo');
			return { ...cls.toObject(), subjects: subs };
		}));

		res.status(200).send({
			success: true,
			data: {
				classes: classesWithSubjects,
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
		logger.error('Error in listClasses:', error);
		if (error.name === 'CastError') {
			return res.status(400).json(createErrorResponse('Invalid ID format'));
		}
		res.status(500).json(createErrorResponse('Internal server error while fetching classes'));
	}
};

/**
 * GET one Class by its ID
 */
exports.getClass = async (req, res) => {
	try {
		const { id } = req.params;
		const schoolId = req.user.school;

		// Find and scope to this school
		const classes = await Classes.findOne({ _id: id, school: schoolId })
			.populate('school', 'name')
			.populate('educationalSegment', 'name acronym')
			.populate('yearLevel', 'name acronym')
			.populate('academicYear', 'year')
			.populate('room', 'name')
			.populate('teacherResponsible', 'firstName lastName email photo');

		if (!classes) return res.status(404).json(createErrorResponse('Class not found'));

		// Populate subjects
		const subs = await Subjects.find({ classes: id, school: schoolId })
			.select('name description')
			.populate('employees', 'firstName lastName email photo');

		return res.json({
			success: true,
			data: { ...classes.toObject(), subjects: subs }
		});

	} catch (error) {
		logger.error('getClass error:', error);
		if (error.name === 'CastError') {
			return res.status(400).json(createErrorResponse('Invalid ID format'));
		}
		return res.status(500).json(createErrorResponse('Internal server error'));
	}
};

/**
 * Add a new class
 */
exports.addClass = async (req, res) => {
	try {
		const data = req.body;
		const schoolId = req.user?.school;

		// Validate status if provided
		if (data.status && !['active', 'disabled', 'archived'].includes(data.status)) {
			return res.status(400).json(createErrorResponse('Invalid status value. Must be one of: active, disabled, archived'));
		}

		// Validate required fields
		if (!data.name || !data.startDate || !data.endDate) {
			return res.status(400).json(createErrorResponse('Validation error', [
				{ field: 'name', message: 'Name is required' },
				{ field: 'startDate', message: 'Start date is required' },
				{ field: 'endDate', message: 'End date is required' }
			].filter(field => !data[field.field])));
		}

		// Validate dates
		const startDate = new Date(data.startDate);
		const endDate = new Date(data.endDate);

		if (endDate <= startDate) {
			return res.status(400).json(createErrorResponse('Validation error', [{
				field: 'endDate',
				message: 'End date must be after start date'
			}]));
		}

		// Validate subjects if provided
		if (data.subjects && Array.isArray(data.subjects)) {
			// Validate subject IDs format
			const invalidIds = data.subjects.filter(id => !mongoose.Types.ObjectId.isValid(id));
			if (invalidIds.length > 0) {
				return res.status(400).json(createErrorResponse('Invalid subject IDs provided'));
			}

			// Verify subjects exist and belong to the school
			const validSubjects = await Subjects.find({
				_id: { $in: data.subjects },
				school: schoolId
			});

			if (validSubjects.length !== data.subjects.length) {
				return res.status(400).json(createErrorResponse('One or more subjects not found or do not belong to your school'));
			}
		}

		const segment = await EducationalSegment.findOne({ _id: data.educationalSegment, school: schoolId });
		if (!segment) return res.status(400).json(createErrorResponse('Invalid segment'));

		const AcYear = await AcademicYear.findOne({ _id: data.academicYear, school: schoolId });
		if (!AcYear) return res.status(400).json(createErrorResponse('Invalid academic year'));

		const yearLevel = await YearLevel.findOne({ _id: data.yearLevel, educationalSegment: segment._id });
		if (!yearLevel) return res.status(400).json(createErrorResponse('Invalid year level'));

		if (data.room) {
			const room = await Room.findOne({ _id: data.room, school: schoolId });
			if (!room) return res.status(400).json(createErrorResponse('Invalid room'));
		}

		if (data.teacherResponsible) {
			const teacher = await User.findOne({ _id: data.teacherResponsible, school: schoolId });
			if (!teacher) return res.status(400).json(createErrorResponse('Invalid teacher'));
		}

		// Create new class object
		const newClass = new Classes({
			...data,
			school: schoolId,
			status: data.status || 'active'
		});

		// Save class
		await newClass.save();

		// If subjects are provided, create subject associations
		if (data.subjects && Array.isArray(data.subjects) && data.subjects.length > 0) {
			// Add this class to each subject's classes array
			await Subjects.updateMany(
				{
					_id: { $in: data.subjects },
					school: schoolId
				},
				{ $addToSet: { classes: newClass._id } }
			);

			// Fetch the updated class with subjects
			const classWithSubjects = await Classes.findById(newClass._id)
				.populate('school', 'name');
			const subjects = await Subjects.find({
				classes: classWithSubjects._id,
				school: schoolId
			}).select('name description');

			return res.status(201).json({
				success: true,
				message: 'Class created successfully with subjects',
				data: {
					...classWithSubjects.toObject(),
					subjects
				}
			});
		}

		res.status(201).json({
			success: true,
			message: 'Class created successfully',
			data: newClass
		});

	} catch (error) {
		logger.error('Error creating class:', error);
		if (error.name === 'ValidationError') {
			return res.status(400).json(createErrorResponse('Validation error',
				Object.values(error.errors).map(err => ({
					field: err.path,
					message: err.message
				}))
			));
		}
		res.status(500).json(createErrorResponse('Internal error while creating class', error.message));
	}
};

/**
 * Updates the status of a Class
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateClassStatus = async (req, res) => {
	try {
		const { id } = req.params;
		const { status } = req.body;
		const schoolId = req.user?.school;

		console.log("updateClassStatus req.body", req.body);

		if (typeof status !== 'string' || !['active', 'inactive', 'archived'].includes(status)) {
			return res.status(400).json({
				success: false,
				message: 'Status must be one of: active, inactive, archived'
			});
		}

		// Find the class and check if it belongs to the school
		const classToUpdate = await Classes.findOne({ _id: id, school: schoolId });

		if (!classToUpdate) {
			return res.status(404).json({
				success: false,
				message: 'Class not found or does not belong to this school'
			});
		}

		// Update class status
		const updatedClass = await Classes.findByIdAndUpdate(
			id,
			{ $set: { status: status } },
			{ new: true }
		).populate('school', 'name');

		res.json({
			success: true,
			message: 'Class status updated successfully',
			data: updatedClass
		});

	} catch (error) {
		logger.error('Error updating class status:', error);
		res.status(500).json(createErrorResponse('Error updating class status', error.message));
	}
};

/**
 * Update class information
 */
exports.updateClass = async (req, res) => {
	try {
		const updates = req.body;
		const { id } = req.params;
		const schoolId = req.user?.school;

		// Validate status if provided
		if (updates.status && !['active', 'inactive', 'archived'].includes(updates.status)) {
			return res.status(400).json(createErrorResponse('Invalid status value. Must be one of: active, disabled, archived'));
		}

		// Fields that cannot be updated
		const restrictedFields = ['school'];
		restrictedFields.forEach(field => delete updates[field]);

		// Find the class and check if it belongs to the school
		const classToUpdate = await Classes.findOne({ _id: id, school: schoolId });
		if (!classToUpdate) {
			return res.status(404).json(createErrorResponse('Class not found or does not belong to this school'));
		}

		// Validate dates if they are being updated
		if (updates.startDate || updates.endDate) {
			const startDate = new Date(updates.startDate || classToUpdate.startDate);
			const endDate = new Date(updates.endDate || classToUpdate.endDate);

			if (endDate <= startDate) {
				return res.status(400).json(createErrorResponse('Validation error', [{
					field: 'endDate',
					message: 'End date must be after start date'
				}]));
			}
		}

		// Validate subjects if provided
		if (updates.subjects && Array.isArray(updates.subjects)) {
			// Validate subject IDs format
			const invalidIds = updates.subjects.filter(id => !mongoose.Types.ObjectId.isValid(id));
			if (invalidIds.length > 0) {
				return res.status(400).json(createErrorResponse('Invalid subject IDs provided'));
			}

			// Verify subjects exist and belong to the school
			const validSubjects = await Subjects.find({
				_id: { $in: updates.subjects },
				school: schoolId
			});

			if (validSubjects.length !== updates.subjects.length) {
				return res.status(400).json(createErrorResponse('One or more subjects not found or do not belong to your school'));
			}

			// Get current subjects for this class
			const currentSubjects = await Subjects.find({
				classes: id,
				school: schoolId
			}).select('_id');
			const currentSubjectIds = currentSubjects.map(s => s._id.toString());

			// Find subjects to add and remove
			const subjectsToAdd = updates.subjects.filter(id => !currentSubjectIds.includes(id.toString()));
			const subjectsToRemove = currentSubjectIds.filter(id => !updates.subjects.includes(id.toString()));

			// Add class to new subjects
			if (subjectsToAdd.length > 0) {
				await Subjects.updateMany(
					{
						_id: { $in: subjectsToAdd },
						school: schoolId
					},
					{ $addToSet: { classes: id } }
				);
			}

			// Remove class from removed subjects
			if (subjectsToRemove.length > 0) {
				await Subjects.updateMany(
					{
						_id: { $in: subjectsToRemove },
						school: schoolId
					},
					{ $pull: { classes: id } }
				);
			}

			// Remove subjects from updates object as we've handled them separately
			delete updates.subjects;
		}

		const segment = await EducationalSegment.findOne({ _id: updates.educationalSegment, school: schoolId });
		if (!segment) return res.status(400).json(createErrorResponse('Invalid segment'));

		const AcYear = await AcademicYear.findOne({ _id: updates.academicYear, school: schoolId });
		if (!AcYear) return res.status(400).json(createErrorResponse('Invalid academic year'));

		console.log(updates.yearLevel);
		const yearLevel = await YearLevel.findOne({ _id: updates.yearLevel, educationalSegment: segment._id });
		if (!yearLevel) return res.status(400).json(createErrorResponse('Invalid year level'));

		if (updates.room) {
			const room = await Room.findOne({ _id: updates.room, school: schoolId });
			if (!room) return res.status(400).json(createErrorResponse('Invalid room'));
		}

		if (updates.teacherResponsible) {
			const teacher = await User.findOne({ _id: updates.teacherResponsible, school: schoolId });
			if (!teacher) return res.status(400).json(createErrorResponse('Invalid teacher'));
		}

		// Update class information
		const updatedClass = await Classes.findByIdAndUpdate(
			id,
			{ $set: updates },
			{ new: true }
		).populate('school', 'name');

		// Get updated subjects list
		const subjects = await Subjects.find({
			classes: id,
			school: schoolId
		}).select('name description');

		res.json({
			success: true,
			message: 'Class updated successfully',
			data: {
				...updatedClass.toObject(),
				subjects
			}
		});

	} catch (error) {
		logger.error('Error updating class:', error);
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
		res.status(500).json(createErrorResponse('Error updating class', error.message));
	}
};

/**
 * Delete a class
 */
exports.deleteClass = async (req, res) => {
	try {
		const { id } = req.params;
		const requestingUser = req.user;

		const classToDelete = await Classes.findById(id).populate('school');

		if (!classToDelete) {
			return res.status(404).json(createErrorResponse('Class not found'));
		}

		if (requestingUser.role !== 'backoffice') {
			if (!classToDelete.school || !requestingUser.school ||
				classToDelete.school._id.toString() !== requestingUser.school.toString()) {
				return res.status(403).json(createErrorResponse('You dont have permission to delete classes from other schools'));
			}
		}

		// Remove this class from all associated subjects
		await Subjects.updateMany(
			{ classes: id },
			{ $pull: { classes: id } }
		);

		// Delete the class
		await Classes.findByIdAndDelete(id);

		return res.status(200).json({
			success: true,
			message: 'Class deleted successfully',
			data: {
				id: classToDelete._id,
				name: classToDelete.name,
				school: classToDelete.school ? {
					id: classToDelete.school._id,
					name: classToDelete.school.name
				} : null
			}
		});

	} catch (error) {
		logger.error('Delete class error:', error);
		return res.status(500).json(createErrorResponse('Internal error while deleting class'));
	}
};
