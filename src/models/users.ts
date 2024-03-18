import * as mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    orderID: { type: mongoose.Schema.Types.ObjectId, required: true},
    eventID: { type: mongoose.Schema.Types.ObjectId, required: true},
    ticketType: { type: String, required: true},
    ticketQuantity: { type: Number, required: true},
    timeOfPurchase: { type: Date, default: Date.now, required: true}
},{_id: false});

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, minLength: 1 },
    password: { type: String, required: true,  minLength: 1},
    permission: { type: String, required: true, enum:["W","M","A","U"]},
    orders: { type: [orderSchema], required: false},
});

// Create models from schemas and export them
export default mongoose.model("User", userSchema);