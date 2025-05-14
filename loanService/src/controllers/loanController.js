import Loan from '../models/Loan.js';
import axios from 'axios';
import CircuitBreaker from '../utils/circuitBreaker.js';


const bookServiceBreaker = new CircuitBreaker({
    request: axios,
    failureThreshold: 3,
    timeout: 5000,
    resetTimeout: 30000,
    fallback: () => ({
        status: 503,
        data: { isAvailable: false, message: 'Book service unavailable' }
    })
});

const userServiceBreaker = new CircuitBreaker({
    request: axios,
    failureThreshold: 3,
    timeout: 5000,
    resetTimeout: 30000,
    fallback: () => ({
        status: 503,
        data: { message: 'User service unavailable' }
    })
});

class LoanController {
    static bookServiceBreaker = bookServiceBreaker;
    static userServiceBreaker = userServiceBreaker;

    static async issueBook(req, res) {
        try {
            const { user_id, book_id, due_date } = req.body;

            const bookAvailability = await LoanController.bookServiceBreaker.get(
                `${process.env.BOOK_BACKEND_BASE_URI}/api/books/available/${book_id}`
            );
            if (bookAvailability.status !== 200 || !bookAvailability.data.isAvailable) {
                return res.status(bookAvailability.status === 503 ? 503 : 400).json({
                    message: bookAvailability.data.message || 'Book is not available'
                });
            }

            const loan = new Loan({
                user_id,
                book_id,
                due_date,
                status: 'ACTIVE'
            });

            const decrementResponse = await LoanController.bookServiceBreaker.put(
                `${process.env.BOOK_BACKEND_BASE_URI}/api/books/decrement/${book_id}`
            );
            if (decrementResponse.status !== 200) {
                return res.status(decrementResponse.status).json({
                    message: decrementResponse.data.message || 'Error updating book stock'
                });
            }

            await loan.save();

            const loanResponse = {
                id: loan._id,
                user_id: loan.user_id,
                book_id: loan.book_id,
                issue_date: loan.issue_date.toISOString(),
                due_date: loan.due_date.toISOString(),
                status: loan.status
            };

            res.status(201).json({ message: 'Book issued successfully', loan: loanResponse });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    static async returnBook(req, res) {
        try {
            const { loan_id } = req.body;
            const loan = await Loan.findById(loan_id);
            if (!loan || loan.status === 'RETURNED') {
                return res.status(404).json({ message: 'Loan not found or already returned' });
            }

            const incrementResponse = await LoanController.bookServiceBreaker.put(
                `${process.env.BOOK_BACKEND_BASE_URI}/api/books/increment/${loan.book_id}`
            );
            if (incrementResponse.status !== 200) {
                return res.status(incrementResponse.status).json({
                    message: incrementResponse.data.message || 'Error updating book stock'
                });
            }

            loan.return_date = new Date();
            loan.status = 'RETURNED';
            await loan.save();

            const returnResponse = {
                id: loan._id,
                user_id: loan.user_id,
                book_id: loan.book_id,
                issue_date: loan.issue_date.toISOString(),
                due_date: loan.due_date.toISOString(),
                return_date: loan.return_date.toISOString(),
                status: loan.status
            };

            res.status(200).json({ message: 'Book returned successfully', loan: returnResponse });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    static async getLoansByUser(req, res) {
        try {
            const loans = await Loan.find({ user_id: req.params.user_id });

            const loanResponse = [];
            for (const loan of loans) {
                const bookResponse = await LoanController.bookServiceBreaker.get(
                    `${process.env.BOOK_BACKEND_BASE_URI}/api/books/${loan.book_id}`
                );
                if (bookResponse.status !== 200) {
                    return res.status(bookResponse.status).json({
                        message: bookResponse.data.message || 'Error fetching book details'
                    });
                }
                const book = bookResponse.data;
                loanResponse.push({
                    id: loan._id,
                    book: {
                        id: book.id,
                        title: book.title,
                        author: book.author
                    },
                    issue_date: loan.issue_date.toISOString(),
                    due_date: loan.due_date.toISOString(),
                    return_date: loan.return_date ? loan.return_date.toISOString() : null,
                    status: loan.status
                });
            }
            res.status(200).json({ message: 'Loans fetched successfully', loans: loanResponse });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    static async getOverdueLoans(req, res) {
        try {
            const today = new Date();
            const overdueLoans = await Loan.find({
                due_date: { $lt: today },
                status: 'ACTIVE'
            });

            const overdueResponse = [];
            for (const loan of overdueLoans) {
                const [userResponse, bookResponse] = await Promise.all([
                    LoanController.userServiceBreaker.get(
                        `${process.env.USER_BACKEND_BASE_URI}/api/users/${loan.user_id}`
                    ),
                    LoanController.bookServiceBreaker.get(
                        `${process.env.BOOK_BACKEND_BASE_URI}/api/books/${loan.book_id}`
                    )
                ]);

                if (userResponse.status !== 200 || bookResponse.status !== 200) {
                    return res.status(503).json({
                        message:
                            userResponse.data.message ||
                            bookResponse.data.message ||
                            'Error fetching user or book details'
                    });
                }

                const user = userResponse.data;
                const book = bookResponse.data;

                overdueResponse.push({
                    id: loan._id,
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email
                    },
                    book: {
                        id: book.id,
                        title: book.title,
                        author: book.author
                    },
                    issue_date: loan.issue_date.toISOString(),
                    due_date: loan.due_date.toISOString(),
                    days_overdue: Math.floor((today - loan.due_date) / (1000 * 60 * 60 * 24))
                });
            }
            res.status(200).json({ message: 'Overdue loans fetched successfully', loans: overdueResponse });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    static async extendLoan(req, res) {
        try {
            const { extension_days } = req.body;
            const loan = await Loan.findById(req.params.id);

            if (!loan || loan.status === 'RETURNED') {
                return res.status(404).json({ message: 'Loan not found or already returned' });
            }

            const original_due_date = new Date(loan.due_date);
            const extended_due_date = new Date(loan.due_date);
            extended_due_date.setDate(extended_due_date.getDate() + parseInt(extension_days));
            loan.due_date = extended_due_date;

            loan.extensions_count += 1;
            await loan.save();

            const extendedLoanResponse = {
                id: loan._id,
                user_id: loan.user_id,
                book_id: loan.book_id,
                issue_date: loan.issue_date.toISOString(),
                original_due_date: original_due_date.toISOString(),
                extended_due_date: loan.due_date.toISOString(),
                status: loan.status,
                extensions_count: loan.extensions_count
            };

            res.status(200).json({ message: 'Loan extended successfully', loan: extendedLoanResponse });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    static async aggregateActiveLoans(req, res) {
        try {
            const activeLoanUserIds = await Loan.aggregate([
                { $match: { status: 'ACTIVE' } },
                { $group: { _id: '$user_id', books_borrowed: { $sum: 1 } } },
                { $sort: { books_borrowed: -1 } },
                { $limit: 5 }
            ]);
            if (activeLoanUserIds.length === 0) {
                res.status(404).json({ message: 'No active loans found' });
            } else {
                res.status(200).json({
                    message: 'Active loans aggregated successfully',
                    active_loans: activeLoanUserIds
                });
            }
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    static async aggregateLoanByBorrowCount(req, res) {
        try {
            const popularBookIds = await Loan.aggregate([
                { $group: { _id: '$book_id', borrow_count: { $sum: 1 } } },
                { $sort: { borrow_count: -1 } },
                { $limit: 5 }
            ]);
            if (popularBookIds.length === 0) {
                res.status(404).json({ message: 'No popular books found' });
            } else {
                res.status(200).json({
                    message: 'Popular books aggregated successfully',
                    popular_books: popularBookIds
                });
            }
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }

    static async getStatsOverview(req, res) {
        try {
            if (!LoanController.bookServiceBreaker || !LoanController.userServiceBreaker) {
                throw new Error('Circuit breakers are not initialized');
            }

            const bookCount = await LoanController.bookServiceBreaker.get(
                `${process.env.BOOK_BACKEND_BASE_URI}/api/books/count`
            );
            if (bookCount.status !== 200) {
                return res.status(bookCount.status).json({
                    message: bookCount.data.message || 'Error fetching book count'
                });
            }
            const totalBooks = bookCount.data.count;

            const userCount = await LoanController.userServiceBreaker.get(
                `${process.env.USER_BACKEND_BASE_URI}/api/users/count`
            );
            if (userCount.status !== 200) {
                return res.status(userCount.status).json({
                    message: userCount.data.message || 'Error fetching user count'
                });
            }
            const totalUsers = userCount.data.count;

            const availableBookCount = await LoanController.bookServiceBreaker.get(
                `${process.env.BOOK_BACKEND_BASE_URI}/api/books/available/count`
            );
            if (availableBookCount.status !== 200) {
                return res.status(availableBookCount.status).json({
                    message: availableBookCount.data.message || 'Error fetching available book count'
                });
            }
            const booksAvailable = availableBookCount.data.count;

            const booksBorrowed = await Loan.countDocuments({ status: 'ACTIVE' });
            const overdueLoans = await Loan.countDocuments({
                status: 'ACTIVE',
                due_date: { $lt: new Date() }
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const loansToday = await Loan.countDocuments({
                issue_date: { $gte: today },
                status: 'ACTIVE'
            });

            const returnsToday = await Loan.countDocuments({
                return_date: { $gte: today }
            });

            res.status(200).json({
                message: 'Stats overview fetched successfully',
                total_books: totalBooks,
                total_users: totalUsers,
                books_available: booksAvailable,
                books_borrowed: booksBorrowed,
                overdue_loans: overdueLoans,
                loans_today: loansToday,
                returns_today: returnsToday
            });
        } catch (error) {
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    }
}

export default LoanController;