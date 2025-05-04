import mongoose from "mongoose";

const bookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        index: true
    },
    author: {
        type: String,
        required: true
    },
    isbn: {
        type: String,
        unique: true,
        required: true
    },
    copies: {
        type: Number,
        default: 1
    },
    available_copies: {
        type: Number,
        default: function() {
            return this.copies;
        }
    }
}, {
    timestamps: true
});

const Book = mongoose.model('Book', bookSchema);
export default Book;