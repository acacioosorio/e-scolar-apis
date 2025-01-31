const { randomUUID } = require('crypto');
const Classes = require('./classes.model');
const School = require('../schools/school.model');
const { logger } = require('../../helpers');

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
            return res.status(400).send({ error: 'School ID is required' });
        }

        // Check if user has permission to view classes
        if (req.user && req.user.school.toString() !== schoolId.toString() && req.user.role !== 'master') {
            return res.status(403).send({ error: 'Not authorized to view classes from this school' });
        }

        const school = await School.findById(schoolId);
        if (!school) {
            return res.status(404).send({ error: 'School not found' });
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

        res.status(200).send({
            success: true,
            data: {
                classes,
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
            return res.status(400).send({ error: 'Invalid ID format' });
        }
        res.status(500).send({ error: 'Internal server error while fetching classes' });
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
            return res.status(400).json({
                error: 'Validation error',
                details: [
                    { field: 'name', message: 'Name is required' },
                    { field: 'startDate', message: 'Start date is required' },
                    { field: 'endDate', message: 'End date is required' }
                ].filter(field => !data[field.field])
            });
        }

        // Validate dates
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        
        if (endDate <= startDate) {
            return res.status(400).json({
                error: 'Validation error',
                details: [{
                    field: 'endDate',
                    message: 'End date must be after start date'
                }]
            });
        }

        // Create new class object
        const newClass = new Classes({
            ...data,
            school: schoolId
        });

        // Save class
        try {
            await newClass.save();
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

        res.status(201).json({
            success: true,
            message: 'Class created successfully',
            data: newClass
        });

    } catch (error) {
        logger.error('Error creating class:', error);
        res.status(500).json({
            error: 'Internal error while creating class',
            message: error.message
        });
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
            return res.status(404).json({
                success: false,
                message: 'Class not found or does not belong to this school'
            });
        }

        // Validate dates if they are being updated
        if (updates.startDate || updates.endDate) {
            const startDate = new Date(updates.startDate || classToUpdate.startDate);
            const endDate = new Date(updates.endDate || classToUpdate.endDate);
            
            if (endDate <= startDate) {
                return res.status(400).json({
                    error: 'Validation error',
                    details: [{
                        field: 'endDate',
                        message: 'End date must be after start date'
                    }]
                });
            }
        }

        // Update class information
        const updatedClass = await Classes.findByIdAndUpdate(
            updates._id,
            { $set: updates },
            { new: true }
        ).populate('school', 'name');

        res.json({
            success: true,
            message: 'Class updated successfully',
            data: updatedClass
        });

    } catch (error) {
        logger.error('Error updating class:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating class',
            error: error.message
        });
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
            return res.status(404).json({ error: 'Class not found' });
        }

        // Check if requesting user has permission (same school or backoffice)
        if (requestingUser.role !== 'backoffice') {
            // For non-backoffice users, check if schools match
            if (!classToDelete.school || !requestingUser.school || 
                classToDelete.school._id.toString() !== requestingUser.school.toString()) {
                return res.status(403).json({ 
                    error: 'You dont have permission to delete classes from other schools' 
                });
            }
        }

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
        return res.status(500).json({ error: 'Internal error while deleting class' });
    }
};
