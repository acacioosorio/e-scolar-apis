// Payment Model
// ./api/payments/payment.model.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Schema para Pagamentos (Payments)
const PaymentSchema = new Schema(
    {
        school: {
            type: Schema.Types.ObjectId,
            ref: "School", // Refere-se ao modelo 'School'
            required: [true, "School is required"],
        },
        charge: { // Cobrança que está sendo paga
            type: Schema.Types.ObjectId,
            ref: "Charge", // Refere-se ao modelo 'Charge'
            required: [true, "Charge reference is required"],
        },
        student: { // Aluno associado (redundante mas útil para queries)
            type: Schema.Types.ObjectId,
            ref: "Student", // Refere-se ao modelo 'Student'
            required: [true, "Student reference is required"],
        },
        valuePaid: {
            type: Number,
            required: [true, "Paid value is required"],
            min: 0,
        },
        paymentDate: {
            type: Date,
            default: Date.now,
            required: true,
        },
        paymentMethod: { // Método de pagamento
            type: String,
            enum: ["Boleto", "Cartão de Crédito", "Transferência", "Dinheiro", "Outro"],
        },
        transactionId: String, // ID da transação, se aplicável
        notes: String, // Observações sobre o pagamento
    },
    { timestamps: true }
);

// Adicionar lógica pós-save para atualizar o status da Cobrança (Charge)
PaymentSchema.post('save', async function(doc, next) {
    try {
        const Charge = mongoose.model('Charge');
        // Marcar a cobrança como 'Pago' e adicionar referência ao pagamento
        // Idealmente, verificar se o valor pago cobre o valor da cobrança
        await Charge.findByIdAndUpdate(doc.charge, { status: 'Pago', payment: doc._id });
        next();
    } catch (error) {
        console.error("Error updating charge status after payment save:", error);
        // Considerar como lidar com o erro
        next(error); // Propagar o erro
    }
});

// Index para otimizar buscas de pagamentos por aluno ou cobrança
PaymentSchema.index({ school: 1, student: 1, paymentDate: -1 });
PaymentSchema.index({ school: 1, charge: 1 }, { unique: true }); // Garante um pagamento por cobrança

module.exports = mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);

