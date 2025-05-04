import Book from '../models/Book.js';
import LoanController from './loanController.js';


class BookController{
    static async addBook(req, res) {
        try {
            const { title, author, isbn, copies } = req.body;
            const book = new Book({ title, author, isbn, copies });
            await book.save();
            res.status(201).json({message: "Book added successfully", book});
        } catch (error) {
            res.status(500).json({ message: "Internal server errror", error: error.message });
        }
    }

    static async searchBooks(req, res) {
        try {
            const searchQuery = req.query.search || '';
            const books = await Book.find({
                $or: [
                    { title: { $regex: searchQuery, $options: 'i' } },
                    { author: { $regex: searchQuery, $options: 'i' } },
                    { genre: { $regex: searchQuery, $options: 'i' } }
                ]
            });
            if (books.length === 0) {
                return res.status(404).json({ message: "No books found" });
            }
            res.status(200).json({message: "Books fetched successfully", books});
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async getBookById(req, res) {
        try {
            const book = await this.getBook(req.params.id);
            if (!book) {
                return res.status(404).json({ message: "Book not found" });
            }
            res.status(200).json({message: "Book fetched successfully", book});
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async updateBook(req, res) {
        try {
            const { copies, available_copies } = req.body;
            const book = await Book.findByIdAndUpdate(req.params.id, { copies, available_copies }, { new: true });
            if (!book) {
                return res.status(404).json({ message: "Book not found" });
            }
            res.status(200).json({message: "Book updated successfully", book});
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async deleteBook(req, res) {
        try {
            const book = await Book.findByIdAndDelete(req.params.id);
            if (!book) {
                return res.status(404).json({ message: "Book not found" });
            }
            res.status(204).json({ message: "Book deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async getPopularBooks(req, res){
        try {
            const popularBookIds = await LoanController.aggregateLoanByBorrowCount();
            const bookIds = popularBookIds.map(item => item._id);
            const books = await Book.find({ _id: { $in: bookIds } });
            const bookMap = new Map(books.map(book => [book._id.toString(), book]));
            const popularBooksWithDetails = popularBookIds
                .map(item => {
                    const book = bookMap.get(item._id.toString());
                    if (!book) {
                        console.warn(`Book not found for book_id: ${item._id}`);
                        return null;
                    }
                    return {
                        book_id: item._id,
                        title: book.title,
                        author: book.author,
                        borrow_count: item.borrow_count
                    };
                })
                .filter(book => book !== null);
            res.status(200).json({ message: "Popular books fetched successfully", popularBooks: popularBooksWithDetails });
        } catch (error) {
            console.error(`Error fetching popular books: ${error.message}`);
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    // New method to check book availability
    static async checkBookAvailability(book_id) {
        const book = await Book.findById(book_id);
        if (!book || book.available_copies <= 0) {
            return { isAvailable: false, book: null };
        }
        return { isAvailable: true, book };
    }

    // New method to decrement available copies
    static async decrementBookCopies(book_id) {
        const book = await Book.findById(book_id);
        if (!book) {
            throw new Error("Book not found");
        }
        if (book.available_copies <= 0) {
            throw new Error("No available copies");
        }
        book.available_copies -= 1;
        await book.save();
        return book;
    }

    // New method to increment available copies
    static async incrementBookCopies(book_id) {
        const book = await Book.findById(book_id);
        if (!book) {
            throw new Error("Book not found");
        }
        book.available_copies += 1;
        await book.save();
        return book;
    }
}

export default BookController;
