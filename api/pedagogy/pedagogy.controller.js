// Pedagogy Controller
// ./api/pedagogy/pedagogy.controller.js

const EducationalSegment = require("./educationalSegment.model");
const YearLevel = require("./yearLevel.model");
const School = require("../schools/school.model");
const Class = require("../classes/classes.model");
const Subject = require("../subjects/subjects.model");
const { logger, createErrorResponse } = require("../../helpers");
const mongoose = require("mongoose");

// --- Educational Segment Controller Functions ---

/**
 * List Educational Segments for the school
 */
exports.listSegments = async (req, res) => {
	try {
		const schoolId = req.query.id || req.user?.school;

		const {
			page = parseInt(req.query.page) || 1,
			limit = parseInt(req.query.limit) || 10,
			sortBy = 'order',
			order = req.query.order === 'desc' ? -1 : 1
		} = req.query;

		const skip = (page - 1) * limit;

		const searchQuery = req.query.search || '';
		const searchFields = req.query.searchFields ? req.query.searchFields.split(',') : ['name', 'acronym'];

		if (!schoolId) {
			return res.status(400).send({ error: 'School ID is required' });
		}

		if (req.user && req.user.school.toString() !== schoolId.toString() && req.user.role !== 'master')
			return res.status(403).json(createErrorResponse('Not authorized to view year levels from this school'));

		const school = await School.findById(schoolId);

		if (!school)
			return res.status(404).json(createErrorResponse('School not found'));

		const filter = { school: schoolId };

		if (req.query.status) filter.status = req.query.status;

		if (searchQuery)
			filter.$or = searchFields.map(field => ({
				[field]: new RegExp(searchQuery, 'i')
			}));


		const [totalCount, segments] = await Promise.all([
			EducationalSegment.countDocuments(filter),
			EducationalSegment.find(filter)
				.sort({ [sortBy]: order === 'desc' ? -1 : 1 })
				.skip(+skip).limit(+limit)
		]);

		const totalPages = Math.ceil(totalCount / limit);

		res.status(200).send({
			success: true,
			data: {
				segments,
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
		logger.error("Error listing educational segments:", error);

		if (error.name === 'CastError')
			return res.status(400).json(createErrorResponse('Invalid ID format'));

		res.status(500).json(createErrorResponse("Internal server error while fetching educational segments", error.message));
	}
};

exports.getSegment = async (req, res) => {
	try {
		const schoolId = req.user.school;
		const { id } = req.params;

		const segment = await EducationalSegment.findOne({ _id: id, school: schoolId });
		if (!segment)
			return sendError(res, 404, 'Segment not found');

		return res.json({ success: true, data: segment });
	} catch (err) {
		logger.error('getSegment error:', err);
		return sendError(res, err.name === 'CastError' ? 400 : 500, err.message);
	}
};

/**
 * LIST YearLevels filtered by EducationalSegment
 * GET /segments/:segmentId/year-levels
 */
exports.listYearLevelsBySegment = async (req, res) => {
	try {
		const schoolId = req.user.school;
		const { segmentId } = req.params;

		// 1) valida que o Segment existe na escola
		const seg = await EducationalSegment.findOne({
			_id: segmentId,
			school: schoolId
		});
		if (!seg) {
			return res
				.status(404)
				.json({ success: false, message: 'Educational Segment not found' });
		}

		// 2) busca todos os YearLevels desse segmento
		const yearLevels = await YearLevel.find({
			educationalSegment: segmentId,
			school: schoolId,
			//status: 'active'        // opcional: só ativos
		}).sort({ order: 1 })       // em ordem crescente

		// 3) envia a resposta
		res.status(200).send({
			success: true,
			data: {
				yearLevels
			}
		});

	} catch (err) {
		console.error('listYearLevelsBySegment error', err);
		if (err.name === 'CastError') {
			return res
				.status(400)
				.json({ success: false, message: 'Invalid ID format' });
		}
		return res
			.status(500)
			.json({ success: false, message: 'Internal server error' });
	}
};

/**
 * Add a new Educational Segment
 */
exports.addSegment = async (req, res) => {
	try {
		const data = req.body;
		const schoolId = req.user?.school;

		// Validate status if provided
		if (data.status && !['active', 'disabled', 'archived'].includes(data.status)) {
			return res.status(400).json(createErrorResponse('Invalid status value. Must be one of: active, disabled, archived'));
		}

		const newSegment = new EducationalSegment({
			...data,
			school: schoolId,
		});

		await newSegment.save();
		res.status(201).json({ success: true, message: "Segment created successfully", data: newSegment });

	} catch (error) {
		logger.error("Error creating educational segment:", error);
		if (error.name === "ValidationError" || error.code === 11000) {
			return res.status(400).json(createErrorResponse("Validation/Duplicate error", error.message));
		}
		res.status(500).json(createErrorResponse("Internal error while creating segment", error.message));
	}
};

/**
 * Update an Educational Segment
 */
exports.updateSegment = async (req, res) => {
	try {
		const updates = req.body;
		const schoolId = req.user?.school;
		const segmentId = req.params.id;

		if (!segmentId) {
			return res.status(400).json(createErrorResponse("Segment ID is required for update"));
		}

		// Validate status if provided
		if (updates.status && !['active', 'disabled', 'archived'].includes(updates.status)) {
			return res.status(400).json(createErrorResponse('Invalid status value. Must be one of: active, disabled, archived'));
		}

		delete updates.school;
		delete updates.yearLevels; // Prevent direct manipulation of yearLevels array here
		delete updates.subjects; // Prevent direct manipulation of subjects array here

		const updatedSegment = await EducationalSegment.findOneAndUpdate(
			{ _id: segmentId, school: schoolId },
			{ $set: updates },
			{ new: true, runValidators: true }
		);

		if (!updatedSegment) {
			return res.status(404).json(createErrorResponse("Segment not found or does not belong to this school"));
		}

		res.status(200).json({ success: true, message: "Segment updated successfully", data: updatedSegment });

	} catch (error) {
		logger.error("Error updating educational segment:", error);
		if (error.name === "ValidationError" || error.code === 11000) {
			return res.status(400).json(createErrorResponse("Validation/Duplicate error", error.message));
		}
		res.status(500).json(createErrorResponse("Internal error while updating segment", error.message));
	}
};

/**
 * Delete an Educational Segment
 */
exports.deleteSegment = async (req, res) => {
	try {
		const { id } = req.params;
		const schoolId = req.user?.school;

		const segmentToDelete = await EducationalSegment.findOne({ _id: id, school: schoolId });

		if (!segmentToDelete) {
			return res.status(404).json(createErrorResponse("Segment not found or does not belong to this school", error.message));
		}

		// Check if there are any subjects associated with this segment
		const subjectsCount = await Subject.countDocuments({ educationalSegment: id });
		if (subjectsCount > 0) {
			return res.status(400).json(createErrorResponse("Cannot delete segment with associated subjects. Please remove subjects first.", error.message));
		}

		// Check if there are any classes associated with this segment
		const classesCount = await Class.countDocuments({ educationalSegments: id });
		if (classesCount > 0) {
			return res.status(400).json(createErrorResponse("Cannot delete segment with associated classes. Please remove classes first.", error.message));
		}

		// Remove segment from all associated YearLevels
		await YearLevel.updateMany(
			{ school: schoolId, educationalSegments: id },
			{ $pull: { educationalSegments: id } }
		);

		await EducationalSegment.findByIdAndDelete(id);

		res.status(200).json({ success: true, message: "Segment deleted successfully", data: { id } });

	} catch (error) {
		logger.error("Error deleting educational segment:", error);
		res.status(500).json(createErrorResponse("Internal error while deleting segment", error.message));
	}
};

// --- Year Level Controller Functions ---

/**
 * List Year Levels
 */
exports.listYearLevels = async (req, res) => {
	try {
		const schoolId = req.query.id || req.user?.school;
		const searchQuery = req.query.search || '';
		const searchFields = req.query.searchFields ? req.query.searchFields.split(',') : ['name', 'acronym'];
		const classId = req.query.classId;

		const {
			page = parseInt(req.query.page) || 1,
			limit = parseInt(req.query.limit) || 10,
			sortBy = 'order',
			order = req.query.order === 'desc' ? -1 : 1
		} = req.query;

		const skip = (page - 1) * limit;

		if (!schoolId) {
			return res.status(400).send({ error: 'School ID is required' });
		}

		if (req.user && req.user.school.toString() !== schoolId.toString() && req.user.role !== 'master')
			return res.status(403).json(createErrorResponse('Not authorized to view year levels from this school'));

		const school = await School.findById(schoolId);
		if (!school)
			return res.status(404).json(createErrorResponse('School not found'));

		const filter = { school: schoolId, ...(req.query.segment && { educationalSegment: req.query.segment }) };

		if (classId) filter.classes = classId;

		if (req.query.status) {
			if (['active', 'disabled', 'archived'].includes(req.query.status)) {
				filter.status = req.query.status;
			} else {
				return res.status(400).json(createErrorResponse('Invalid status value. Must be one of: active, disabled, archived'));
			}
		}

		if (searchQuery)
			filter.$or = searchFields.map(field => ({
				[field]: new RegExp(searchQuery, 'i')
			}));


		const [totalCount, yearLevels] = await Promise.all([
			YearLevel.countDocuments(filter),
			YearLevel.find(filter)
				.sort({ [sortBy]: order })
				.skip(+skip).limit(+limit)
				.populate('educationalSegment', 'name acronym')
				.populate({
					path: 'subjects',
					select: 'name description',
					populate: {
						path: 'employees',
						select: 'firstName lastName email photo status'
					}
				})
		]);

		const totalPages = Math.ceil(totalCount / limit);

		res.status(200).send({
			success: true,
			data: {
				yearLevels,
				pagination: {
					currentPage: page,
					totalPages: totalPages,
					totalItems: totalCount,
					itemsPerPage: limit,
					hasNextPage: page < totalPages,
					hasPreviousPage: page > 1
				}
			}
		});

	} catch (error) {
		logger.error("Error listing year levels:", error);
		if (error.name === 'CastError')
			return res.status(400).json(createErrorResponse('Invalid ID format'));

		res.status(500).json(createErrorResponse("Internal server error while fetching year levels", error.message));
	}
};

/**
 * Get a Year Level
 */
exports.getYearLevel = async (req, res) => {
	try {
		const schoolId = req.user.school;
		const yl = await YearLevel.findOne({ _id: req.params.id, school: schoolId })
			.populate('educationalSegment', 'name acronym')
			.populate({
				path: 'subjects',
				select: 'name description',
				populate: {
					path: 'employees',
					select: 'firstName lastName email photo'
				}
			})
		if (!yl) return createError(res, 404, 'YearLevel not found');
		return res.json({ success: true, data: yl });
	} catch (err) {
		return createError(res, err.name === 'CastError' ? 400 : 500, err.message);
	}
};

/**
 * Add a new Year Level
 */
exports.addYearLevel = async (req, res) => {
	try {
		const { subjects: subjectsToAdd, educationalSegment, status = 'active', ...data } = req.body;
		const schoolId = req.user?.school;
		let validSubjectsIds = [];

		// Validate status if provided
		if (status && !['active', 'disabled', 'archived'].includes(status)) {
			return res.status(400).json(createErrorResponse('Invalid status value. Must be one of: active, disabled, archived'));
		}

		// Validate educational segment
		if (!educationalSegment) {
			return res.status(400).json(createErrorResponse("Educational segment is required"));
		}

		const seg = await EducationalSegment.findOne({ _id: educationalSegment, school: schoolId });
		if (!seg) {
			return res.status(400).json(createErrorResponse("Invalid educational segment"));
		}

		// Validate subjects if provided
		if (subjectsToAdd && Array.isArray(subjectsToAdd) && subjectsToAdd.length > 0) {
			// Validate all subjects exist and belong to the school
			const subjects = await Subject.find({
				_id: { $in: subjectsToAdd },
				school: schoolId
			}).select("_id");

			validSubjectsIds = subjects.map(s => s._id);
			if (validSubjectsIds.length !== subjectsToAdd.length) {
				return res.status(400).json(createErrorResponse("One or more provided Subjects are invalid or do not belong to this school"));
			}
		}

		const newYearLevel = new YearLevel({
			...data,
			school: schoolId,
			educationalSegment: seg._id,
			subjects: validSubjectsIds,
			status
		});

		await newYearLevel.save();

		const populatedYearLevel = await YearLevel.findById(newYearLevel._id)
			.populate('educationalSegment', 'name acronym')
			.populate({
				path: 'subjects',
				select: 'name description',
				populate: {
					path: 'employees',
					select: 'firstName lastName email photo'
				}
			});

		res.status(201).json({ success: true, message: "Year Level created successfully", data: populatedYearLevel });

	} catch (error) {
		logger.error("Error creating year level:", error);
		if (error.name === "ValidationError" || error.code === 11000) {
			return res.status(400).json(createErrorResponse("Validation/Duplicate error", error.message));
		}
		res.status(500).json(createErrorResponse("Internal error while creating year level", error.message));
	}
};

/**
 * Update a Year Level
 */
exports.updateYearLevel = async (req, res) => {
	try {
		const updates = req.body;
		const schoolId = req.user?.school;
		const yearLevelId = req.params.id;

		if (!yearLevelId) {
			return res.status(400).json(createErrorResponse("Year Level ID is required for update"));
		}

		const yearLevelToUpdate = await YearLevel.findOne({ _id: yearLevelId, school: schoolId });
		if (!yearLevelToUpdate) {
			return res.status(404).json(createErrorResponse("Year Level not found or does not belong to this school"));
		}

		// Validate status if provided
		if (updates.status && !['active', 'disabled', 'archived'].includes(updates.status)) {
			return res.status(400).json(createErrorResponse('Invalid status value. Must be one of: active, disabled, archived'));
		}

		// prevent segment change (or re-validate if you allow)
		delete updates.school;
		delete updates.educationalSegment;

		// re-validate subjects if present
		if (Array.isArray(updates.subjects)) {
			const validSubs = await Subject.find({
				_id: { $in: updates.subjects },
				school: schoolId
			}).select('_id');
			updates.subjects = validSubs.map(s => s._id);
		}

		const updatedYearLevel = await YearLevel.findByIdAndUpdate(
			yearLevelId,
			{ $set: updates },
			{ new: true, runValidators: true }
		)
			.populate({
				path: 'subjects',
				select: 'name description',
				populate: {
					path: 'employees',
					select: 'name email photo'
				}
			});

		res.status(200).json({ success: true, message: "Year Level updated successfully", data: updatedYearLevel });

	} catch (error) {
		logger.error("Error updating year level:", error);
		if (error.name === "ValidationError" || error.code === 11000) {
			return res.status(400).json(createErrorResponse("Validation/Duplicate error", error.message));
		}
		res.status(500).json(createErrorResponse("Internal error while updating year level", error.message));
	}
};

/**
 * Delete a Year Level
 */
exports.deleteYearLevel = async (req, res) => {
	try {
		const { id } = req.params;
		const schoolId = req.user?.school;

		const yearLevelToDelete = await YearLevel.findOne({ _id: id, school: schoolId });

		if (!yearLevelToDelete) {
			return res.status(404).json(createErrorResponse("Year Level not found or does not belong to this school"));
		}

		// Get affected classes with basic information
		const affectedClasses = await Class.find({ yearLevel: id, school: schoolId })
			.select('name academicYear startDate endDate')
			.populate('academicYear', 'year title');

		if (affectedClasses.length > 0) {

			const errorMessage = {
				details: {
					yearLevelName: yearLevelToDelete.name,
					affectedClassesCount: affectedClasses.length,
					affectedClasses: affectedClasses.map(cls => ({
						name: cls.name,
						academicYear: cls.academicYear ? {
							year: cls.academicYear.year,
							title: cls.academicYear.title
						} : null,
						period: `${new Date(cls.startDate).getFullYear()} - ${new Date(cls.endDate).getFullYear()}`
					}))
				},
				suggestions: [
					"Remove or reassign all classes using this year level before deletion",
					"Consider archiving this year level instead of deletion to maintain historical data"
				]
			}

			return res.status(400).json(createErrorResponse("Cannot delete Year Level with associated Classes", errorMessage));

			// return res.status(400).json({
			// 	success: false,
			// 	error: {
			// 		message: "Cannot delete Year Level with associated Classes",
			// 		details: {
			// 			yearLevelName: yearLevelToDelete.name,
			// 			affectedClassesCount: affectedClasses.length,
			// 			affectedClasses: affectedClasses.map(cls => ({
			// 				name: cls.name,
			// 				academicYear: cls.academicYear ? {
			// 					year: cls.academicYear.year,
			// 					title: cls.academicYear.title
			// 				} : null,
			// 				period: `${new Date(cls.startDate).getFullYear()} - ${new Date(cls.endDate).getFullYear()}`
			// 			}))
			// 		},
			// 		suggestions: [
			// 			"Remove or reassign all classes using this year level before deletion",
			// 			"Consider archiving this year level instead of deletion to maintain historical data"
			// 		]
			// 	}
			// });
		}

		await YearLevel.findByIdAndDelete(id);

		res.status(200).json({ 
			success: true, 
			message: "Year Level deleted successfully", 
			data: { 
				id,
				name: yearLevelToDelete.name,
				acronym: yearLevelToDelete.acronym
			} 
		});

	} catch (error) {
		logger.error("Error deleting year level:", error);
		res.status(500).json(createErrorResponse("Internal error while deleting year level"));
	}
};