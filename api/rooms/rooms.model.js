// Rooms Model
// ./api/rooms/rooms.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RoomSchema = new Schema({
  school:   { type: Schema.Types.ObjectId, ref: 'School', required: true },
  name:     { type: String, required: [true, 'Please add a room name'] },
  location: { type: String },                // ex: "Bloco A, 2º andar"
  capacity: { type: Number, default: 0 },    // qtde máxima de alunos
  resources:[{ name: String, quantity: Number }], // ex: [{ name: "Projetor", quantity: 1 }, { name: "Ar condicionado", quantity: 1 }]
  status:   { type: String, default: 'active' },
}, { timestamps: true });

RoomSchema.index({ school: 1, name: 1 }, { unique: true });

module.exports = mongoose.models.Room || mongoose.model('Room', RoomSchema);
