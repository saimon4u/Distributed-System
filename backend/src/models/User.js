import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    role: {
        type: String,
        enum: ['student', 'faculty'],
        required: true
    }
}, {
    timestamps: true
});

const User = mongoose.model('User', userSchema);
export default User;