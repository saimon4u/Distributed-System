import Book from '../models/Book.js';
import axios from 'axios';
import CircuitBreaker from '../utils/circuitBreaker.js';

const loanServiceBreaker = new CircuitBreaker({
    request: axios,
    failureThreshold: 3,
    timeout: 5000,
    resetTimeout: 30000,
    fallback: () => ({
        status: 503,
        data: { message: 'Loan service unavailable', popularBooks: [] }
    })
});

class BookController {
    static loanServiceBreaker = loanServiceBreaker;

    static async addBook(req, res) {
        try {
            const { title, author, isbn, copies } = req.body;
            const book = new Book({ title, author, isbn, copies });
            await book.save();
            res.status(201).json({ message: "Book added successfully", book });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
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
            res.status(200).json({ message: "Books fetched successfully", books });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async getBookById(req, res) {
        try {
            const book = await Book.findById(req.params.id);
            if (!book) {
                return res.status(404).json({ message: "Book not found" });
            }
            res.status(200).json({ message: "Book fetched successfully", book });
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
            res.status(200).json({ message: "Book updated successfully", book });
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

    static async getPopularBooks(req, res) {
        try {
            if (!BookController.loanServiceBreaker) {
                throw new Error('Loan service circuit breaker not initialized');
            }

            const popularBooksResponse = await BookController.loanServiceBreaker.get(
                `${process.env.LOAN_BACKEND_BASE_URI}/api/loans/aggregate/popular-books`
            );
            if (popularBooksResponse.status !== 200) {
                return res.status(popularBooksResponse.status).json({
                    message: popularBooksResponse.data.message || 'Error fetching popular books'
                });
            }

            const popularBookIds = popularBooksResponse.data.popular_books;
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

    static async checkBookAvailability(req, res) {
        try {
            const book = await Book.findById(req.params.id);
            if (!book || book.available_copies <= 0) {
                return res.status(404).json({ message: "Book not available", isAvailable: false });
            }
            res.status(200).json({ message: "Book is available", isAvailable: true });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async decrementBookCopies(req, res) {
        try {
            const book = await Book.findById(req.params.id);
            if (!book) {
                return res.status(404).json({ message: "Book not found" });
            }
            if (book.available_copies <= 0) {
                return res.status(400).json({ message: "No available copies to decrement" });
            }
            book.available_copies -= 1;
            await book.save();
            res.status(200).json({ message: "Book copies decremented successfully" });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async incrementBookCopies(req, res) {
        try {
            const book = await Book.findById(req.params.id);
            if (!book) {
                return res.status(404).json({ message: "Book not found" });
            }
            book.available_copies += 1;
            await book.save();
            res.status(200).json({ message: "Book copies incremented successfully" });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async getBookCount(req, res) {
        try {
            const count = await Book.countDocuments();
            res.status(200).json({ message: "Book count fetched successfully", count });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async getAvailableBookCount(req, res) {
        try {
            const count = await Book.countDocuments({ available_copies: { $gt: 0 } });
            res.status(200).json({ message: "Available book count fetched successfully", count });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }
}

export default BookController;