const { randomUUID } = require('crypto');
const Subjects = require('./subjects.model');
const Classes = require('../classes/classes.model');
const School = require('../schools/school.model');
const { logger } = require('../../helpers');

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

        if (!schoolId) {
            return res.status(400).send({ error: 'School ID is required' });
        }

        // Check if user has permission to view subjects
        if (req.user && req.user.school.toString() !== schoolId.toString() && req.user.role !== 'master') {
            return res.status(403).send({ error: 'Not authorized to view subjects from this school' });
        }

        // Verify the school exists
        const school = await School.findById(schoolId);
        if (!school) {
            return res.status(404).send({ error: 'School not found' });
        }

        // Build filter object starting with classes from the school
        const schoolClasses = await Classes.find({ school: schoolId }).select('_id');
        const schoolClassIds = schoolClasses.map(c => c._id);

        const filter = { classes: { $in: schoolClassIds } };

        // Add specific class filter if provided
        if (classId) {
            filter.classes = classId;
        }

        // Add search conditions if search query exists
        if (searchQuery) {
            filter.$or = searchFields.map(field => ({
                [field]: new RegExp(searchQuery, 'i')
            }));
        }

        // Get total count for pagination
        const totalCount = await Subjects.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / limit);

        // Get subjects with sorting and populate classes
        const subjects = await Subjects.find(filter)
            .sort({ [req.query.sortBy || 'name']: order })
            .skip(skip)
            .limit(limit)
            .populate('classes', 'name');

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
        if (error.name === 'CastError') {
            return res.status(400).send({ error: 'Invalid ID format' });
        }
        res.status(500).send({ error: 'Internal server error while fetching subjects' });
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
        if (!data.name || !data.classes || !data.classes.length) {
            return res.status(400).json({
                error: 'Validation error',
                details: [
                    { field: 'name', message: 'Name is required' },
                    { field: 'classes', message: 'At least one class is required' }
                ].filter(field => !data[field.field])
            });
        }

        // Verify all classes belong to the school
        const classes = await Classes.find({
            _id: { $in: data.classes },
            school: schoolId
        });

        if (classes.length !== data.classes.length) {
            return res.status(400).json({
                error: 'Validation error',
                message: 'One or more classes do not belong to your school'
            });
        }

        // Create new subject object
        const newSubject = new Subjects({
            name: data.name,
            description: data.description,
            classes: data.classes
        });

        // Save subject
        try {
            await newSubject.save();
        } catch (saveError) {
            // Handle Mongoose validation errors
            if (saveError.name === 'ValidationError') {
                return res.status(400).json({
                    error: 'Validation error',
                    details: Object.values(saveError.errors).map(err => ({
                        field: err.path,
                        message: err.message
                    }))
                });
            }
            throw saveError;
        }

        // Populate classes before sending response
        await newSubject.populate('classes', 'name');

        res.status(201).json({
            success: true,
            message: 'Subject created successfully',
            data: newSubject
        });

    } catch (error) {
        logger.error('Error creating subject:', error);
        res.status(500).json({
            error: 'Internal error while creating subject',
            message: error.message
        });
    }
};

/**
 * Update subject information
 */
exports.updateSubject = async (req, res) => {
    try {
        const updates = req.body;
        const schoolId = req.user?.school;

        // Find the subject and verify it belongs to a class in the school
        const schoolClasses = await Classes.find({ school: schoolId }).select('_id');
        const schoolClassIds = schoolClasses.map(c => c._id);

        const subjectToUpdate = await Subjects.findOne({
            _id: updates._id,
            classes: { $in: schoolClassIds }
        });

        if (!subjectToUpdate) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found or does not belong to your school\'s classes'
            });
        }

        // If updating classes, verify they belong to the school
        if (updates.classes && updates.classes.length > 0) {
            const newClasses = await Classes.find({
                _id: { $in: updates.classes },
                school: schoolId
            });

            if (newClasses.length !== updates.classes.length) {
                return res.status(400).json({
                    error: 'Validation error',
                    message: 'One or more classes do not belong to your school'
                });
            }
        }

        // Update subject information
        const updatedSubject = await Subjects.findByIdAndUpdate(
            updates._id,
            { $set: updates },
            { new: true }
        ).populate('classes', 'name');

        res.json({
            success: true,
            message: 'Subject updated successfully',
            data: updatedSubject
        });

    } catch (error) {
        logger.error('Error updating subject:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating subject',
            error: error.message
        });
    }
};

/**
 * Delete a subject
 */
exports.deleteSubject = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user?.school;

        // Find the subject and verify it belongs to a class in the school
        const schoolClasses = await Classes.find({ school: schoolId }).select('_id');
        const schoolClassIds = schoolClasses.map(c => c._id);

        const subjectToDelete = await Subjects.findOne({
            _id: id,
            classes: { $in: schoolClassIds }
        }).populate('classes', 'name');

        if (!subjectToDelete) {
            return res.status(404).json({ 
                error: 'Subject not found or does not belong to your school\'s classes' 
            });
        }

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
        return res.status(500).json({ error: 'Internal error while deleting subject' });
    }
};
