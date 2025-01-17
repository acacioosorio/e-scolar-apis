const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

const UserSchema = new Schema({
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
        unique: true,
        required: [true, 'Please add an E-mail'],
    },
    password: {
        type: String,
        required: true
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
    school: { type: Schema.Types.ObjectId, ref: 'School' },
    messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    roles: [{ type: String, enum: ['Master', 'Admin', 'Teacher', 'Concierge', 'Parent'] }],
    active: {
        type: Boolean,
        default: false
    },
    validateHash: {
        hash: { type: String, default: '' },
        hashExpiration: { type: Date }
    }
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
    console.log("UserSchema.pre 'save'", this.isModified('password'));
    if (this.isModified('password') || this.isNew) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(this.password, salt);
        this.password = hash;
    }
    next();
});

UserSchema.pre('findOneAndUpdate', async function (next) {
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

module.exports = mongoose.model('User', UserSchema);