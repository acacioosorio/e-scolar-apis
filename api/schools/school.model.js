// School Model
// ./api/schools/school.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
const Users = require('../users/users.model');
const Students = require('../students/students.model');

mongoose.Promise = global.Promise;

/**
 * Represents a mongoose schema for a School.
 *
 * @class
 * @name SchoolSchema
 *
 * @property {string} name - The name of the school.
 * @property {string} slug - The slug of the school.
 * @property {string} CNPJ - The CNPJ of the school.
 * @property {string} email - The email of the school.
 * @property {string} telephone - The telephone number of the school.
 * @property {Array} employees - The employees associated with the school.
 * @property {Array} students - The students associated with the school.
 * @property {Array} responsiblesWaiting - The waiting list of responsibles associated with the school.
 * @property {Array} responsiblesApproved - The approved responsibles associated with the school.
 * @property {object} location - The location of the school.
 * @property {string} location.address - The address of the school.
 * @property {string} location.number - The number of the school.
 * @property {string} location.complement - The complement of the school address.
 * @property {string} location.cep - The CEP of the school.
 * @property {string} location.neighborhood - The neighborhood of the school.
 * @property {string} location.city - The city of the school.
 * @property {string} location.state - The state of the school.
 * @property {string} location.latLng - The latitude and longitude of the school.
 * @property {boolean} active - Indicates if the school is active.
 * @property {string} apiKey - The API key of the school.
 * @property {string} logo - The logo of the school.
 * @property {string} facade - The facade of the school.
 * @property {Array} educationTypes - The educational stages associated with the school.
 * @property {Array} courses - The courses associated with the school.
 * @property {Array} responsibles - The responsibles associated with the school.
 * @property {boolean} responsibles.required - Indicates if the student must belong to at least one responsible.
 * @property {object} timestamps - The timestamps of the school.
 *
 * @returns {object} - The mongoose model for the School schema.
 */
const SchoolSchema = new Schema({
	name: {
		type: String,
		trim: true,
		required: [true, "Please add a School Name"],
	},
	code: {
		type: String,
		unique: [true, "School Code already Exists"],
	},
	slug: String,
	CNPJ: {
		type: String,
		trim: true,
		unique: [true, "CNPJ already Exists"],
		required: [true, "Please add a CNPJ"],
		maxlength: 2000,
	},
	email: {
		type: String,
		trim: true,
		required: [true, "Please add an Email"],
	},
	website: {
		type: String,
		trim: true,
	},
	telephone: {
		type: String,
		trim: true,
		required: [true, "Please add a Phone Number"],
		match: [
			/^(?:(?:\+|00)?(55)\s?)?(?:\(?([1-9][0-9])\)?\s?)(?:((?:9\d|[2-9])\d{3})\-?(\d{4}))$/,
			"Please add a valid Phone Number",
		],
	},
	academicYear: {
		type: Schema.Types.ObjectId,
		ref: "AcademicYear",
		required: [true, "Academic Year is required"],
	},
	students: [{ type: Schema.Types.ObjectId, ref: "Student" }],
	employees: [{ type: Schema.Types.ObjectId, ref: "Users" }],
	responsiblesWaiting: [{ type: Schema.Types.ObjectId, ref: "Users" }],
	responsiblesApproved: [{ type: Schema.Types.ObjectId, ref: "Users" }],
	location: {
		address: String,
		number: String,
		complement: String,
		cep: String,
		neighborhood: String,
		city: String,
		state: String,
		latLng: String,
	},
	active: Boolean,
	apiKey: String,
	logo: String,
	facade: String,
}, { timestamps: true });

module.exports = mongoose.models.School || mongoose.model('School', SchoolSchema);