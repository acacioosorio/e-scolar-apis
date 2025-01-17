const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
mongoose.Promise = global.Promise;

const UsersSchema = new Schema({
	firstName: {
		type: String,
		required: true
	},
	lastName: {
		type: String,
		required: true
	},
	email: {
		type: String,
		unique: [true, 'Please add another e-mail'],
		required: [true, 'Please add an E-mail'],
	},
	photo: String,
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
	contact: {
		phone: String,
		cellPhone: String,
		otherPhone: String
	},
	documents: {
		rg: {
			type: String,
			unique: true,
			required: [true, 'Please add a RG Number'],
		},
		cpf: {
			type: String,
			unique: true,
			required: [true, 'Please add a CPF Number'],
		}
	},
	school: {
		type: Schema.Types.ObjectId,
		ref: 'School',
		required: function () {
			return this.role === 'school';
		}
	},
	// students: [{ type: Schema.Types.ObjectId, ref: 'Student' }], // Uncomment after creating Student model
	// messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }], // Uncomment after creating Message model
	role: {
		type: String,
		enum: ['parent', 'school', 'backoffice'],
		required: true,
	},
	subRole: {
		type: String,
		enum: ['admin', 'staff', 'concierge'],
		required: function () {
			return this.role === 'school';
		},
	},
	password: {
		type: String,
		required: true
	},
	active: {
		type: Boolean,
		default: false
	},
	validateHash: {
		hash: {
			type: String,
			default: null,
			sparse: true // Allows null values and creates index only for non-null values
		},
		hashExpiration: {
			type: Date,
			default: null,
			sparse: true
		}
	}
}, {
	timestamps: true,
	toJSON: { virtuals: true },
	toObject: { virtuals: true }
});

UsersSchema.pre('save', async function (next) {
	console.log("UsersSchema.pre 'save'", this.isModified('password'));
	if (this.isModified('password') || this.isNew) {
		const salt = await bcrypt.genSalt(10);
		const hash = await bcrypt.hash(this.password, salt);
		this.password = hash;
	}
	next();
});

UsersSchema.pre('findOneAndUpdate', async function (next) {
	const update = this.getUpdate();
	// @ts-ignore
	if (update.$set && update.$set.password) {
		const salt = await bcrypt.genSalt(10);
		// @ts-ignore
		const hash = await bcrypt.hash(update.$set.password, salt);
		// @ts-ignore
		update.$set.password = hash;
	}

	next();
});

UsersSchema.virtual('validationPending').get(function () {
	return !this.active &&
		this.validateHash?.hash &&
		this.validateHash?.hashExpiration &&
		new Date(this.validateHash.hashExpiration) > new Date();
});

module.exports = mongoose.models.Users || mongoose.model('Users', UsersSchema);