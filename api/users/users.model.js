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
		unique: [true, "Email already in use"],
		required: [true, "Please add an Email"],
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
		otherPhone: String,
	},
	documents: {
		rg: {
			type: String,
			required: [true, 'Please add a RG Number'],
			index: {
				unique: true,
				partialFilterExpression: { role: 'parent' }
			}
		},
		cpf: {
			type: String,
			required: [true, 'Please add a CPF Number'],
			index: {
				unique: true,
				partialFilterExpression: { role: 'parent' }
			}
		}
	},
	school: {
		type: Schema.Types.ObjectId,
		ref: 'School',
		required: function () {
			return this.role === 'school';
		}
	},
	role: {
		type: String,
		enum: ['parent', 'school', 'backoffice'],
		required: true,
	},
	subRole: {
		type: String,
		enum: ['admin', 'staff', 'teacher', 'concierge'],
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
	status: {
		type: String,
		enum: ['active', 'inactive', 'pending'],
		default: 'pending'
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
	// Update status based on active and validateHash

	console.log(this.active, this.validateHash?.hash);

	if (this.active === true && this.validateHash?.hash === null) {
		this.status = 'active';
	} else if (this.active === false && this.validateHash?.hash !== null) {
		this.status = 'pending';
	} else {
		this.status = 'inactive';
	}

	// Handle password hashing
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

// Make sure virtuals are included in JSON and Object conversions
UsersSchema.set('toJSON', { virtuals: true });
UsersSchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.Users || mongoose.model('Users', UsersSchema);