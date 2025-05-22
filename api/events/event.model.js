// Event Model
// ./api/events/event.model.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Schema para Eventos Escolares
const EventSchema = new Schema(
    {
        school: {
            type: Schema.Types.ObjectId,
            ref: "School", // Refere-se ao modelo 'School'
            required: [true, "School is required"],
        },
        title: {
            type: String,
            required: [true, "Event title is required"],
            trim: true,
        },
        description: String,
        startDate: {
            type: Date,
            required: [true, "Event start date is required"],
        },
        endDate: Date, // Opcional, para eventos de múltiplos dias
        location: String, // Local do evento
        targetAudience: { // Público-alvo
            type: String,
            enum: ["Toda a Escola", "Funcionários", "Pais/Responsáveis", "Alunos", "Turma Específica"],
            default: "Toda a Escola",
        },
        targetClasses: [ // Se for para turmas específicas
            {
                type: Schema.Types.ObjectId,
                ref: "Classes", // Refere-se ao modelo 'Classes'
            },
        ],
        createdBy: { // Quem criou o evento (Usuário)
            type: Schema.Types.ObjectId,
            ref: "Users", // Refere-se ao modelo 'Users'
        },
    },
    { timestamps: true }
);

// Index para otimizar buscas por data
EventSchema.index({ school: 1, startDate: 1 });

module.exports = mongoose.models.Event || mongoose.model("Event", EventSchema);

