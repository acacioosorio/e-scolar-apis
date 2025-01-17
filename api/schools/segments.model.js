const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
mongoose.Promise = global.Promise;

/**
 * Defines a Mongoose schema for Segments.
 *
 * @class
 * @name SegmentSchema
 *
 * @property {string} name - The name of the segment.
 * @property {string} type - The type of the segment.
 * @property {string} acronym - The acronym of the segment.
 * @property {string} comments - Additional comments for the segment.
 * @property {Schema.Types.ObjectId} school - The ID of the associated school.
 * @property {Schema.Types.ObjectId[]} yearLevels - An array of associated year level IDs.
 * @property {boolean} active - Indicates if the segment is active.
 * @property {Date} createdAt - The creation date of the segment.
 * @property {Date} updatedAt - The last update date of the segment.
 *
 * @returns {mongoose.Model} The Mongoose model for Segments.
 */
const SegmentSchema = new Schema({
	name: {
		type: String,
		required: true
	},
	type: {
		type: String,
		required: true
	},
	acronym: {
		type: String,
		required: true
	},
	comments: { type: String },
	school: { type: Schema.Types.ObjectId, ref: 'School' },
	yearLevels: [{ type: Schema.Types.ObjectId, ref: 'YearLevel' }],
	active: {
		type: Boolean,
		default: false
	},
}, { timestamps: true });

/**
 * Creates a new YearLevelsSchema object.
 *
 * @class
 * @classdesc Represents a year level in the education system.
 * @param {String} name - The name of the year level.
 * @param {Schema.Types.ObjectId} educationType - The ID of the education type associated with the year level.
 * @param {Boolean} [active=false] - Indicates if the year level is active or not.
 * @param {Object} [timestamps] - The timestamps for the year level object.
 * @param {Date} [timestamps.createdAt] - The date and time when the year level was created.
 * @param {Date} [timestamps.updatedAt] - The date and time when the year level was last updated.
 * @returns {YearLevelsSchema} The YearLevelsSchema object.
 * @example
 * const yearLevel = new YearLevelsSchema('Grade 1', '5f7e9a7b9e4e5f001f7e9a7c', true);
 */

const YearLevelsSchema = new Schema({
	name: {
		type: String,
		required: true
	},
	segments: [{ type: Schema.Types.ObjectId, ref: 'Segments', required: true }],
	order: {
		type: Number,
		required: true
	},
	active: {
		type: Boolean,
		default: false
	},
}, { timestamps: true });

module.exports = {
	Segments: mongoose.models.SegmentSchema || mongoose.model('Segments', SegmentSchema),
	YearLevel: mongoose.models.YearLevelsSchema || mongoose.model('YearLevel', YearLevelsSchema)
}