// Academic Years Controller
// ./api/academic-years/academicYears.controller.js

const AcademicYear = require('./academicYear.model');
const Class = require('../classes/classes.model');
const { logger, createErrorResponse } = require('../../helpers');

// Helper for errors
const sendError = (res, status, msg) =>
	res.status(status).json({ success: false, message: msg });

// LISTAGEM com paginação, filtro por status e busca
exports.listAcademicYears = async (req, res) => {
	try {
		const schoolId = req.query.id || req.user.school;
		
		const { page = parseInt(req.query.page) || 1, limit = parseInt(req.query.limit) || 10, sortBy = 'year', order = req.query.order === 'desc' ? -1 : 1 } = req.query;
		const searchQuery = req.query.search || '';
		const searchFields = req.query.searchFields ? req.query.searchFields.split(',') : ['title', 'year'];
		const skip = (page - 1) * limit;
		const filter = { school: schoolId };
		
		if (searchQuery)
			filter.$or = searchFields.map(field => ({
				[field]: new RegExp(searchQuery, 'i')
			}));

		if (req.query.status) filter.status = req.query.status === 'active' ? true : false;

		const [totalCount, academicYears] = await Promise.all([
			AcademicYear.countDocuments(filter),
			AcademicYear.find(filter)
				.sort({ [sortBy]: order === 'desc' ? -1 : 1 })
				.skip(+skip)
				.limit(+limit)
		]);

		const totalPages = Math.ceil(totalCount / limit);

		console.log(filter);

		res.status(200).send({
			success: true,
			data: {
				academicYears,
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
	} catch (err) {
		logger.error('Error in listSubjects:', error);
		if (error.name === 'CastError')
			return res.status(400).json(createErrorResponse('Invalid ID format'));

		res.status(500).json(createErrorResponse('Internal server error while fetching academic years'));
	}
};

// GET único
exports.getAcademicYear = async (req, res) => {
	try {
		const schoolId = req.user.school;
		const { id } = req.params;

		const item = await AcademicYear.findOne({ _id: id, school: schoolId });
		if (!item) return sendError(res, 404, 'AcademicYear not found');

		return res.json({ success: true, data: item });
	} catch (err) {
		logger.error('getAcademicYear error', err);
		return sendError(res, err.name === 'CastError' ? 400 : 500, err.message);
	}
};

// CRIAÇÃO
exports.addAcademicYear = async (req, res) => {
	try {
		const schoolId = req.user.school;
		const data = req.body;

		// Validação de datas
		if (new Date(data.startDate) > new Date(data.endDate))
			return sendError(res, 400, 'startDate must be before endDate');

		// If this academic year is set as current, update all others to false
		if (data.isCurrent) {
			await AcademicYear.updateMany(
				{ school: schoolId, isCurrent: true },
				{ isCurrent: false }
			);
		}

		const newAY = await AcademicYear.create({
			school: schoolId,
			...data
		});

		return res.status(201).json({
			success: true,
			message: 'AcademicYear created',
			data: newAY
		});
	} catch (err) {
		logger.error('addAcademicYear error', err);
		if (err.code === 11000 || err.name === 'ValidationError')
			return sendError(res, 400, 'Duplicate or validation error');
		return sendError(res, 500, err.message);
	}
};

// ATUALIZAÇÃO
exports.updateAcademicYear = async (req, res) => {
	try {
		const schoolId = req.user.school;
		const { id } = req.params;
		const data = req.body;

		if (startDate && endDate && new Date(startDate) > new Date(endDate))
			return sendError(res, 400, 'startDate must be before endDate');

		// If this academic year is being set as current, update all others to false
		if (isCurrent) {
			await AcademicYear.updateMany(
				{ school: schoolId, _id: { $ne: id }, isCurrent: true },
				{ isCurrent: false }
			);
		}

		const updated = await AcademicYear.findOneAndUpdate(
			{ _id: id, school: schoolId },
			{ ...data },
			{ new: true, runValidators: true }
		);
		if (!updated) return sendError(res, 404, 'AcademicYear not found');

		return res.json({
			success: true,
			message: 'AcademicYear updated',
			data: updated
		});
	} catch (err) {
		logger.error('updateAcademicYear error', err);
		if (err.code === 11000 || err.name === 'ValidationError')
			return sendError(res, 400, 'Duplicate or validation error');
		return sendError(res, 500, err.message);
	}
};

// EXCLUSÃO
exports.deleteAcademicYear = async (req, res) => {
	try {
		const schoolId = req.user.school;
		const { id } = req.params;

		const item = await AcademicYear.findOne({ _id: id, school: schoolId });
		if (!item) return sendError(res, 404, 'AcademicYear not found');

		// Impede remoção se houver Classes vinculadas
		const inUse = await Class.exists({ academicYear: id, school: schoolId });
		if (inUse) return sendError(res, 400, 'Cannot delete academic year with classes');

		// If we're deleting the current academic year, find and set the closest one as current
		if (item.isCurrent) {
			const currentYear = new Date().getFullYear();
			
			// Get all academic years except the one being deleted
			const academicYears = await AcademicYear.find({
				school: schoolId,
				_id: { $ne: id }
			});

			// Find the closest year
			let closestYear = null;
			let minDiff = Infinity;

			academicYears.forEach(ay => {
				// Extract the first year from the year string (e.g., "2023-2024" -> 2023)
				const yearStart = parseInt(ay.year.split('-')[0]);
				const diff = Math.abs(yearStart - currentYear);
				
				if (diff < minDiff) {
					minDiff = diff;
					closestYear = ay;
				}
			});

			if (closestYear) {
				await AcademicYear.findByIdAndUpdate(closestYear._id, { isCurrent: true });
			}
		}

		await AcademicYear.deleteOne({ _id: id });
		return res.json({
			success: true,
			message: 'AcademicYear deleted',
			data: { id }
		});
	} catch (err) {
		logger.error('deleteAcademicYear error', err);
		return sendError(res, err.name === 'CastError' ? 400 : 500, err.message);
	}
};
