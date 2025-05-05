const EducationalSegment = require("./educationalSegment.model");
const YearLevel = require("./yearLevel.model");
const School = require("../schools/school.model");
const Class = require("../classes/classes.model");
const { logger, createErrorResponse } = require("../../helpers");
const mongoose = require("mongoose");

// --- Educational Segment Controller Functions ---

/**
 * List Educational Segments for the school
 */
exports.listSegments = async (req, res) => {
    try {
        const schoolId = req.user?.school;
        const segments = await EducationalSegment.find({ school: schoolId })
            .sort({ order: 1, name: 1 })
            // Populate yearLevels associated with this segment
            // This might need adjustment depending on how we query N:N
            // Maybe populate yearLevels based on YearLevel.find({ educationalSegments: segment._id })
            // For simplicity now, let's keep it, but it might show all year levels linked to the segment
            .populate("yearLevels", "name acronym order");

        res.status(200).json({ success: true, data: { segments } });
    } catch (error) {
        logger.error("Error listing educational segments:", error);
        res.status(500).json(createErrorResponse("Internal server error while fetching segments"));
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

        const updatedSegment = await EducationalSegment.findOneAndUpdate(
            { _id: segmentId, school: schoolId },
            { $set: updates },
            { new: true, runValidators: true }
        ).populate("yearLevels", "name acronym order");

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

        // Check if any YearLevel is associated ONLY with this segment before deleting
        // Or simply remove the segment from all associated YearLevels
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

// --- Year Level Controller Functions (Adjusted for N:N) ---

/**
 * List Year Levels (optionally filtered by segment)
 */
exports.listYearLevels = async (req, res) => {
    try {
        const schoolId = req.user?.school;
        const segmentId = req.query.segmentId;

        const filter = { school: schoolId };
        // if (segmentId) {
        //     if (!mongoose.Types.ObjectId.isValid(segmentId)) {
        //         return res.status(400).json(createErrorResponse("Invalid Segment ID format"));
        //     }
        //     filter.educationalSegments = segmentId;
        // }

        const yearLevels = await YearLevel.find(filter)
            .sort({ order: 1, name: 1 })
            // Populate the segments array
            .populate("educationalSegments", "name acronym")
            .populate("classes", "name");

        res.status(200).json({ success: true, data: { yearLevels } });
    } catch (error) {
        logger.error("Error listing year levels:", error);
        res.status(500).json(createErrorResponse("Internal server error while fetching year levels", error.message));
    }
};

/**
 * Add a new Year Level
 * Can optionally include an array of educationalSegment IDs to associate with.
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
            educationalSegments: validSegmentIds, // Assign validated segment IDs
        });

        await newYearLevel.save();

        // Add year level reference to the associated segments
        if (validSegmentIds.length > 0) {
            await EducationalSegment.updateMany(
                { _id: { $in: validSegmentIds } },
                { $addToSet: { yearLevels: newYearLevel._id } }
            );
        }

        // Populate segments before sending response
        const populatedYearLevel = await YearLevel.findById(newYearLevel._id)
                                        .populate("educationalSegments", "name acronym");

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

        // Prevent updating school directly
        delete updates.school;

        const yearLevelToUpdate = await YearLevel.findOne({ _id: yearLevelId, school: schoolId });

        if (!yearLevelToUpdate) {
            return res.status(404).json(createErrorResponse("Year Level not found or does not belong to this school"));
        }

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