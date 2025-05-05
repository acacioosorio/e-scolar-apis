const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Schema para Cobranças (Charges)
const ChargeSchema = new Schema(
    {
        school: {
            type: Schema.Types.ObjectId,
            ref: "School", // Refere-se ao modelo 'School'
            required: [true, "School is required"],
        },
        student: {
            type: Schema.Types.ObjectId,
            ref: "Student", // Refere-se ao modelo 'Student'
            required: [true, "Student is required"],
        },
        description: {
            type: String,
            required: [true, "Charge description is required"], // Ex: Mensalidade Março, Taxa Material
        },
        value: {
            type: Number,
            required: [true, "Charge value is required"],
            min: 0,
        },
        dueDate: {
            type: Date,
            required: [true, "Due date is required"],
        },
        status: {
            type: String,
            enum: ["Pendente", "Pago", "Atrasado", "Cancelado"],
            default: "Pendente",
            required: true,
        },
        // Referência ao pagamento, se houver
        payment: {
            type: Schema.Types.ObjectId,
            ref: "Payment", // Refere-se ao futuro modelo 'Payment'
        },
    },
    { timestamps: true }
);

// Index para otimizar buscas de cobranças por aluno e status
ChargeSchema.index({ school: 1, student: 1, status: 1 });
ChargeSchema.index({ school: 1, dueDate: 1, status: 1 });

module.exports = mongoose.models.Charge || mongoose.model("Charge", ChargeSchema);

