// Rooms Controller
// ./api/rooms/rooms.controller.js

const School = require("../schools/school.model");
const Room = require('./rooms.model');
const { createErrorResponse } = require('../../helpers');

exports.listRooms = async (req, res, next) => {
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
		const searchFields = req.query.searchFields ? req.query.searchFields.split(',') : ['name', 'location'];

		if (!schoolId) {
			return res.status(400).send({ error: 'School ID is required' });
		}

		if (req.user && req.user.school.toString() !== schoolId.toString() && req.user.role !== 'master')
			return res.status(403).json(createErrorResponse('Not authorized to view rooms from this school'));

		const school = await School.findById(schoolId);

		if (!school)
			return res.status(404).json(createErrorResponse('School not found'));

		const filter = { school: schoolId };

		if (req.query.status) filter.status = req.query.status === 'active' ? true : false;

		if (searchQuery)
			filter.$or = searchFields.map(field => ({
				[field]: new RegExp(searchQuery, 'i')
			}));

		const [totalCount, rooms] = await Promise.all([
			Room.countDocuments(filter),
			Room.find(filter)
				.sort({ [sortBy]: order === 'desc' ? -1 : 1 })
				.skip(+skip).limit(+limit)
		]);

		const totalPages = Math.ceil(totalCount / limit);

		res.status(200).send({
			success: true,
			data: {
				rooms,
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
	} catch (err) { next(err); }
};

exports.getRoom = async (req, res, next) => {
	try {
		const room = await Room.findOne({ _id: req.params.id, school: req.user.school });
		if (!room) return res.status(404).json(createErrorResponse('Room not found'));
		res.json({ success: true, data: room });
	} catch (err) { next(err); }
};

exports.createRoom = async (req, res, next) => {
	try {
		const room = await Room.create({ ...req.body, school: req.user.school });
		res.status(201).json({ success: true, data: room });
	} catch (err) {
		if (err.code === 11000)
			return res.status(400).json(createErrorResponse('A room with this name already exists'));
		next(err);
	}
};

exports.updateRoom = async (req, res, next) => {
	try {
		const room = await Room.findOneAndUpdate(
			{ _id: req.params.id, school: req.user.school },
			req.body,
			{ new: true }
		);
		if (!room) return res.status(404).json(createErrorResponse('Room not found'));
		res.json({ success: true, data: room });
	} catch (err) { next(err); }
};

exports.deleteRoom = async (req, res, next) => {
	try {
		await Room.findOneAndDelete({ _id: req.params.id, school: req.user.school });
		res.status(204).end();
	} catch (err) { next(err); }
};

exports.updateRoomStatus = async (req, res, next) => {
	try {
		const { status } = req.body;
		
		if (typeof status !== 'string' || !['active', 'inactive', 'archived'].includes(status)) {
			return res.status(400).json({
				success: false,
				message: 'Status must be one of: active, inactive, archived'
			});
		}

		console.log("updateRoomStatus req.body", status);

		const updatedRoom = await Room.findByIdAndUpdate(
			req.params.id,
			{ $set: { status: status } },
			{ new: true }
		)

		if (!updatedRoom) {
			return res.status(404).json(createErrorResponse('Room not found'));
		}

		res.json({
			success: true,
			message: 'Room status updated successfully',
			data: updatedRoom
		});
	} catch (err) { next(err); }
};

module.exports = exports;
