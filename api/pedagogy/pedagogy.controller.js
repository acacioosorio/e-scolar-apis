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
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;
		const order = req.query.order === 'desc' ? -1 : 1;
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

		if (req.query.status) filter.status = req.query.status === 'active' ? true : false;

		if (searchQuery)
			filter.$or = searchFields.map(field => ({
				[field]: new RegExp(searchQuery, 'i')
			}));

		const totalCount = await EducationalSegment.countDocuments(filter);
		const totalPages = Math.ceil(totalCount / limit);

		const segments = await EducationalSegment.find(filter)
		.sort({ [req.query.sortBy || 'name']: order })
		.skip(skip)
		.limit(limit)
		.populate('yearLevels', 'name acronym order')
		.populate('subjects', 'name description');

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

/**
 * Add a new Educational Segment
 */
exports.addSegment = async (req, res) => {
    try {
        const data = req.body;
        const schoolId = req.user?.school;

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
        const segmentId = updates._id;

        if (!segmentId) {
            return res.status(400).json(createErrorResponse("Segment ID is required for update"));
        }
        delete updates.school;
        delete updates.yearLevels; // Prevent direct manipulation of yearLevels array here
        delete updates.subjects; // Prevent direct manipulation of subjects array here

        const updatedSegment = await EducationalSegment.findOneAndUpdate(
            { _id: segmentId, school: schoolId },
            { $set: updates },
            { new: true, runValidators: true }
        )
        .populate("yearLevels", "name acronym order")
        .populate("subjects", "name description");

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
 * List Year Levels (optionally filtered by segment)
 */
exports.listYearLevels = async (req, res) => {
    try {
		const schoolId = req.query.id || req.user?.school;
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;
		const order = req.query.order === 'desc' ? -1 : 1;
		const searchQuery = req.query.search || '';
		const searchFields = req.query.searchFields ? req.query.searchFields.split(',') : ['name', 'acronym'];
		const classId = req.query.classId;
        const segmentId = req.query.segmentId;

		if (!schoolId) {
			return res.status(400).send({ error: 'School ID is required' });
		}

		if (req.user && req.user.school.toString() !== schoolId.toString() && req.user.role !== 'master')
			return res.status(403).json(createErrorResponse('Not authorized to view year levels from this school'));

		const school = await School.findById(schoolId);
		if (!school)
			return res.status(404).json(createErrorResponse('School not found'));

        const filter = { school: schoolId };
		
		if (classId) filter.classes = classId;

		if (req.query.status) filter.status = req.query.status === 'active' ? true : false;

		if (searchQuery)
			filter.$or = searchFields.map(field => ({
				[field]: new RegExp(searchQuery, 'i')
			}));

		const totalCount = await YearLevel.countDocuments(filter);
		const totalPages = Math.ceil(totalCount / limit);

		const yearLevels = await YearLevel.find(filter)
		.sort({ [req.query.sortBy || 'name']: order })
		.skip(skip)
		.limit(limit)
		.populate('educationalSegments', 'name acronym type')

		res.status(200).send({
			success: true,
			data: {
				yearLevels,
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
        logger.error("Error listing year levels:", error);
		if (error.name === 'CastError')
			return res.status(400).json(createErrorResponse('Invalid ID format'));

        res.status(500).json(createErrorResponse("Internal server error while fetching year levels", error.message));
    }
};

/**
 * Add a new Year Level
 */
exports.addYearLevel = async (req, res) => {
    try {
        const { educationalSegments, ...data } = req.body;
        const schoolId = req.user?.school;
        let validSegmentIds = [];

        // Validate provided segment IDs if they exist
        if (educationalSegments && Array.isArray(educationalSegments) && educationalSegments.length > 0) {
            const segments = await EducationalSegment.find({
                _id: { $in: educationalSegments },
                school: schoolId
            }).select("_id");

            validSegmentIds = segments.map(s => s._id);
            if (validSegmentIds.length !== educationalSegments.length) {
                return res.status(400).json(createErrorResponse("One or more provided Educational Segments are invalid or do not belong to this school"));
            }
        }

        const newYearLevel = new YearLevel({
            ...data,
            school: schoolId,
            educationalSegments: validSegmentIds,
        });

        await newYearLevel.save();

        // Add year level reference to the associated segments
        if (validSegmentIds.length > 0) {
            await EducationalSegment.updateMany(
                { _id: { $in: validSegmentIds } },
                { $addToSet: { yearLevels: newYearLevel._id } }
            );
        }

        const populatedYearLevel = await YearLevel.findById(newYearLevel._id)
            .populate("educationalSegments", "name acronym")
            .populate("classes", "name");

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
        const yearLevelId = updates._id;

        if (!yearLevelId) {
            return res.status(400).json(createErrorResponse("Year Level ID is required for update"));
        }

        const yearLevelToUpdate = await YearLevel.findOne({ _id: yearLevelId, school: schoolId });
        if (!yearLevelToUpdate) {
            return res.status(404).json(createErrorResponse("Year Level not found or does not belong to this school"));
        }

        delete updates.school;
        delete updates.classes; // Prevent direct manipulation of classes array here

        // Handle educationalSegments updates if provided
        if (updates.educationalSegments) {
            // Validate all new segments exist and belong to the school
            const newSegments = await EducationalSegment.find({
                _id: { $in: updates.educationalSegments },
                school: schoolId
            });

            if (newSegments.length !== updates.educationalSegments.length) {
                return res.status(400).json(createErrorResponse("One or more provided Educational Segments are invalid or do not belong to this school"));
            }

            // Get current segments to compare
            const currentSegments = yearLevelToUpdate.educationalSegments.map(id => id.toString());
            const newSegmentIds = updates.educationalSegments.map(id => id.toString());

            // Find segments to add and remove
            const segmentsToAdd = newSegmentIds.filter(id => !currentSegments.includes(id));
            const segmentsToRemove = currentSegments.filter(id => !newSegmentIds.includes(id));

            // Add year level to new segments
            if (segmentsToAdd.length > 0) {
                await EducationalSegment.updateMany(
                    { _id: { $in: segmentsToAdd } },
                    { $addToSet: { yearLevels: yearLevelId } }
                );
            }

            // Remove year level from old segments
            if (segmentsToRemove.length > 0) {
                await EducationalSegment.updateMany(
                    { _id: { $in: segmentsToRemove } },
                    { $pull: { yearLevels: yearLevelId } }
                );
            }
        }

        const updatedYearLevel = await YearLevel.findByIdAndUpdate(
            yearLevelId,
            { $set: updates },
            { new: true, runValidators: true }
        )
            .populate("educationalSegments", "name acronym")
            .populate("classes", "name");

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

        // Check if year level has classes before deleting
        if (yearLevelToDelete.classes && yearLevelToDelete.classes.length > 0) {
            return res.status(400).json(createErrorResponse("Cannot delete year level with associated classes. Please remove classes first."));
        }

        // Remove year level reference from all associated segments
        if (yearLevelToDelete.educationalSegments && yearLevelToDelete.educationalSegments.length > 0) {
            await EducationalSegment.updateMany(
                { _id: { $in: yearLevelToDelete.educationalSegments } },
                { $pull: { yearLevels: id } }
            );
        }

        await YearLevel.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: "Year Level deleted successfully", data: { id } });

    } catch (error) {
        logger.error("Error deleting year level:", error);
        res.status(500).json(createErrorResponse("Internal error while deleting year level"));
    }
};