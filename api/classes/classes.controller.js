const { randomUUID } = require('crypto');
const Classes = require('./classes.model');
const School = require('../schools/school.model');
const Subjects = require('../subjects/subjects.model');
const { logger, createErrorResponse } = require('../../helpers');
const mongoose = require('mongoose');
const EducationalSegment = require('../pedagogy/educationalSegment.model');

/**
 * List classes with filtering, searching and pagination
 */
exports.listClasses = async (req, res) => {
    try {
        const schoolId = req.query.id || req.user?.school;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const order = req.query.order === 'desc' ? -1 : 1;
        const searchQuery = req.query.search || '';
        const searchFields = req.query.searchFields ? req.query.searchFields.split(',') : ['name'];

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

        // Add search conditions if search query exists
        if (searchQuery) {
            filter.$or = searchFields.map(field => ({
                [field]: new RegExp(searchQuery, 'i')
            }));
        }

        // Get total count for pagination
        const totalCount = await Classes.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / limit);

        // Get classes with sorting
        const classes = await Classes.find(filter)
            .sort({ [req.query.sortBy || 'name']: order })
            .skip(skip)
            .limit(limit)
            .populate('school', 'name');

        // Get subjects for each class
        const classesWithSubjects = await Promise.all(classes.map(async (classItem) => {
            const subjects = await Subjects.find({ classes: classItem._id })
                .select('name description').populate('employees', 'name email photo');
            
            const classObj = classItem.toObject();
            return {
                ...classObj,
                subjects: subjects
            };
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
 * Add a new class
 */
exports.addClass = async (req, res) => {
    try {
        const data = req.body;
        const schoolId = req.user?.school;

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

        // Create new class object
        const newClass = new Classes({
            ...data,
            school: schoolId
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
 * Update class information
 */
exports.updateClass = async (req, res) => {
    try {
        const updates = req.body;
        const schoolId = req.user?.school;

        // Fields that cannot be updated
        const restrictedFields = ['school'];
        restrictedFields.forEach(field => delete updates[field]);

        // Find the class and check if it belongs to the school
        const classToUpdate = await Classes.findOne({ _id: updates._id, school: schoolId });
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
                classes: classToUpdate._id,
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
                    { $addToSet: { classes: classToUpdate._id } }
                );
            }

            // Remove class from removed subjects
            if (subjectsToRemove.length > 0) {
                await Subjects.updateMany(
                    { 
                        _id: { $in: subjectsToRemove },
                        school: schoolId 
                    },
                    { $pull: { classes: classToUpdate._id } }
                );
            }

            // Remove subjects from updates object as we've handled them separately
            delete updates.subjects;
        }

        // Update class information
        const updatedClass = await Classes.findByIdAndUpdate(
            updates._id,
            { $set: updates },
            { new: true }
        ).populate('school', 'name');

        // Get updated subjects list
        const subjects = await Subjects.find({ 
            classes: updatedClass._id,
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

        // Find the class to be deleted
        const classToDelete = await Classes.findById(id).populate('school');

        if (!classToDelete) {
            return res.status(404).json(createErrorResponse('Class not found'));
        }

        // Check if requesting user has permission (same school or backoffice)
        if (requestingUser.role !== 'backoffice') {
            // For non-backoffice users, check if schools match
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

        // Remove this class from all associated educational segments
        await EducationalSegment.updateMany(
            { yearLevels: { $in: classToDelete.yearLevels } },
            { $pull: { yearLevels: classToDelete._id } }
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
