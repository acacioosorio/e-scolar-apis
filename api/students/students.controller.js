const { randomUUID } = require('crypto');
const Student = require('./students.model');
const School = require('../schools/school.model');
const { logger, saveFileToS3, deleteFileFromS3, createErrorResponse } = require('../../helpers');
const slugify = require('slugify');
const Jimp = require('jimp');
const Classes = require('../classes/classes.model');

/**
 * List students with filtering, searching and pagination
 */
exports.listStudents = async (req, res) => {
	try {
		const schoolId = req.query.id || req.user?.school;
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;
		const order = req.query.order === 'desc' ? -1 : 1;
		const searchQuery = req.query.search || '';
		const searchFields = req.query.searchFields ? req.query.searchFields.split(',') : ['name', 'registration'];

		if (!schoolId)
			return res.status(400).json(createErrorResponse('School ID is required'));

		// Check if user has permission to view students
		if (req.user && req.user.school.toString() !== schoolId.toString() && req.user.role !== 'master')
			return res.status(403).json(createErrorResponse('Not authorized to view students from this school'));

		const school = await School.findById(schoolId);
		if (!school)
			return res.status(404).json(createErrorResponse('School not found'));

		// Build filter object
		const filter = { school: schoolId };

		// Add status filter if provided
		if (req.query.status)
			filter.status = req.query.status;

		// Add search conditions if search query exists
		if (searchQuery) {
			const searchConditions = [];
			const hasClassSearch = searchFields.includes('class');
			
			// Handle non-class field searches
			searchFields.forEach(field => {
				if (field !== 'class') {
					searchConditions.push({ [field]: new RegExp(searchQuery, 'i') });
				}
			});

			if (searchConditions.length > 0) {
				filter.$or = searchConditions;
			}
		}

		// Get total count for pagination
		const totalCount = await Student.countDocuments(filter);
		const totalPages = Math.ceil(totalCount / limit);

		// Build the query
		let query = Student.find(filter)
			.select('-password -validateHash')
			.sort({ name: order })
			.skip(skip)
			.limit(limit);

		// If class is in searchFields, populate it
		if (searchFields.includes('class')) {
			query = query.populate({
				path: 'class',
				select: 'name',
				match: searchQuery ? { name: new RegExp(searchQuery, 'i') } : {}
			});
		}

		// Execute query
		let students = await query;

		// Filter out students with no matching class if class search is active
		if (searchFields.includes('class') && searchQuery) {
			students = students.filter(student => student.class !== null);
		}

		res.status(200).send({
			success: true,
			data: {
				students: students,
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
		logger.error('Error in listStudents:', error);
		if (error.name === 'CastError') {
			return res.status(400).json(createErrorResponse('Invalid ID format'));
		}
		res.status(500).json(createErrorResponse('Internal server error while fetching students'));
	}
};

/**
 * Add a new student
 */
exports.addStudent = async (req, res) => {
	try {
		const data = req.body;
		const schoolId = req.user?.school;

		if (!data.name || !data.registration || !data.class) {
			return res.status(400).json(createErrorResponse('Validation error', [
				{ field: 'name', message: 'Name is required' },
				{ field: 'registration', message: 'Registration is required' },
				{ field: 'class', message: 'Class is required' }
			].filter(field => !data[field.field])));
		}

		// Handle photo upload if provided
		if (req.file) {
			const school = await School.findById(schoolId);
			if (!school) {
				return res.status(404).json({ error: 'School not found' });
			}

			try {
				// Process image with Jimp
				const image = await Jimp.read(req.file.buffer);

				// Resize and crop to 512x512
				image.cover(512, 512) // This will maintain aspect ratio and crop to fit
					.quality(90); // Set JPEG quality to 90%

				// Convert the processed image back to buffer
				const processedImageBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

				const slug = await slugify(data.name);
				const savedFile = await saveFileToS3(
					processedImageBuffer,
					'image/jpeg', // Always save as JPEG
					`schools/${school.slug}/students/${slug}`
				);
				data.photo = savedFile.Location;
			} catch (uploadError) {
				logger.error('Error processing or uploading photo:', uploadError);
				return res.status(500).json({ error: 'Error processing or uploading photo' });
			}
		}

		// Verify class belongs to school
		const studentClass = await Classes.findOne({
			_id: data.class,
			school: schoolId
		});

		if (!studentClass) {
			return res.status(404).json(createErrorResponse('Class not found or does not belong to your school'));
		}

		// Create new student object [OK]
		const newStudent = new Student({
			...data,
			school: schoolId,
			active: true,
			status: 'active'  // Students are active by default
		});

		// Save student [OK]
		try {
			await newStudent.save();
		} catch (saveError) {
			// Handle Mongoose validation errors
			if (saveError.name === 'ValidationError') {
				return res.status(400).json(createErrorResponse('Validation error',
					Object.values(saveError.errors).map(err => ({
						field: err.path,
						message: err.message
					}))
				));
			}
			// Handle duplicate key errors
			if (saveError.code === 11000) {
				const field = Object.keys(saveError.keyPattern)[0];
				return res.status(400).json({
					error: 'Erro de duplicidade',
					details: [{
						field,
						message: `Este ${field} já está em uso`
					}]
				});
			}
			throw saveError;
		}

		// Update school with new student
		await School.findByIdAndUpdate(
			schoolId,
			{ $push: { students: newStudent._id } }
		);

		res.status(201).json({
			success: true,
			message: 'Estudante criado com sucesso',
			data: {
				id: newStudent._id,
				firstName: newStudent.firstName,
				lastName: newStudent.lastName,
				email: newStudent.email,
				photo: newStudent.photo
			}
		});

	} catch (error) {
		logger.error('Error creating student:', error);
		res.status(500).json(createErrorResponse('Internal error while creating student', error.message));
	}
};

/**
 * Update student information
 */
exports.updateStudent = async (req, res) => {
	try {
		const updates = req.body;
		const schoolId = req.user?.school;

		// Fields that cannot be updated
		const restrictedFields = ['school', 'status'];
		restrictedFields.forEach(field => delete updates[field]);

		// Find the student and check if they belong to the school
		const student = await Student.findOne({ _id: updates._id, school: schoolId });
		if (!student) {
			return res.status(404).json(createErrorResponse('Student not found or does not belong to your school\'s classes'));
		}

		if (updates.class) {
			const newClass = await Classes.findOne({
				_id: updates.class,
				school: schoolId
			});

			if (!newClass) {
				return res.status(400).json(createErrorResponse('Class not found or does not belong to your school'));
			}
		}

		// Handle photo upload if provided
		if (req.file) {
			const school = await School.findById(schoolId);
			try {
				// Delete old photo if exists
				if (student.photo) {
					const oldPhotoKey = student.photo.split('.com/')[1];
					await deleteFileFromS3(oldPhotoKey);
				}

				const savedFile = await saveFileToS3(
					req.file.buffer,
					req.file.mimetype,
					`schools/${school.slug}/students/${updates.firstName || student.firstName}-${updates.lastName || student.lastName}`
				);
				updates.photo = savedFile.Location;
			} catch (uploadError) {
				logger.error('Error handling photo:', uploadError);
				return res.status(500).json({ error: 'Error handling photo upload' });
			}
		}

		// Update student information
		const updatedStudent = await Student.findByIdAndUpdate(
			updates._id,
			{ $set: updates },
			{
				new: true,
				select: '-validateHash'
			}
		);

		res.json({
			success: true,
			message: 'Student updated successfully',
			data: updatedStudent
		});

	} catch (error) {
		logger.error('Error updating student:', error);
		res.status(500).json(createErrorResponse('Error updating student', error.message));
	}
};

/**
 * Delete a student
 */
exports.deleteStudent = async (req, res) => {
	try {
		const { id } = req.params;
		const requestingUser = req.user;

		// Find the student to be deleted
		const studentToDelete = await Student.findById(id).populate('school');

		if (!studentToDelete)
			return res.status(404).json(createErrorResponse('Student not found or does not belong to your school\'s classes'));

		// Check if requesting user has permission (same school or backoffice)
		if (requestingUser.role !== 'backoffice') {
			// For non-backoffice users, check if schools match
			if (!studentToDelete.school || !requestingUser.school ||
				studentToDelete.school._id.toString() !== requestingUser.school.toString()) {
				return res.status(403).json({
					error: 'You dont have permission to delete students from other schools'
				});
			}
		}

		// Start cleanup process
		const school = await School.findById(studentToDelete.school);

		if (school) {
			// Remove student from school's students array
			await School.findByIdAndUpdate(school._id, { $pull: { students: id } });
		}

		// Delete student's photo from S3 if it exists
		if (studentToDelete.photo) {
			try {
				const photoKey = studentToDelete.photo.split('.com/')[1];
				await deleteFileFromS3(photoKey);
			} catch (error) {
				logger.error('Error deleting photo from S3:', error);
				// Continue with student deletion even if photo deletion fails
			}
		}

		// Delete the student
		await Student.findByIdAndDelete(id);

		return res.status(200).json({
			success: true,
			message: 'Estudante deletado com sucesso.',
			data: {
				id: studentToDelete._id,
				email: studentToDelete.email,
				school: school ? {
					id: school._id,
					name: school.name
				} : null
			}
		});

	} catch (error) {
		logger.error('Delete student error:', error);
		return res.status(500).json(createErrorResponse('Internal error while deleting student'));
	}
};
