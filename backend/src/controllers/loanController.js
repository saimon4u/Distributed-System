import Book from '../models/Book.js';
import Loan from '../models/Loan.js';
import BookController from './bookController.js';
import UserController from './userController.js';



class LoanController {
    static async issueBook(req, res) {
        try {
            const { user_id, book_id, due_date } = req.body;

            // Check book availability via BookController
            const { isAvailable, book } = await BookController.checkBookAvailability(book_id);
            if (!isAvailable) {
                return res.status(400).json({ message: "Book is not available" });
            }

            const loan = new Loan({
                user_id,
                book_id,
                due_date,
                status: 'ACTIVE'
            });

            // Decrement book copies via BookController
            await BookController.decrementBookCopies(book_id);
            await loan.save();

            const loanResponse = {
                id: loan._id,
                user_id: loan.user_id,
                book_id: loan.book_id,
                issue_date: loan.issue_date.toISOString(),
                due_date: loan.due_date.toISOString(),
                status: loan.status
            };

            res.status(201).json({ message: "Book issued successfully", loan: loanResponse });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async returnBook(req, res) {
        try {
            const { loan_id } = req.body;
            const loan = await Loan.findById(loan_id);
            if (!loan || loan.status === 'RETURNED') {
                return res.status(404).json({ message: "Loan not found or already returned" });
            }

            // Increment book copies via BookController
            await BookController.incrementBookCopies(loan.book_id);

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

            res.status(200).json({ message: "Book returned successfully", loan: returnResponse });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async getLoansByUser(req, res) {
        try {
            const loans = await Loan.find({ user_id: req.params.user_id }).populate('book_id');

            const loanResponse = loans.map(loan => ({
                id: loan._id,
                book: {
                    id: loan.book_id._id,
                    title: loan.book_id.title,
                    author: loan.book_id.author
                },
                issue_date: loan.issue_date.toISOString(),
                due_date: loan.due_date.toISOString(),
                return_date: loan.return_date ? loan.return_date.toISOString() : null,
                status: loan.status
            }));

            res.status(200).json({ message: "Loans fetched successfully", loans: loanResponse });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async getOverdueLoans(req, res) {
        try {
            const today = new Date();
            const overdueLoans = await Loan.find({
                due_date: { $lt: today },
                status: 'ACTIVE'
            }).populate('user_id').populate('book_id');

            const overdueResponse = overdueLoans.map(loan => ({
                id: loan._id,
                user: {
                    id: loan.user_id._id,
                    name: loan.user_id.name,
                    email: loan.user_id.email
                },
                book: {
                    id: loan.book_id._id,
                    title: loan.book_id.title,
                    author: loan.book_id.author
                },
                issue_date: loan.issue_date.toISOString(),
                due_date: loan.due_date.toISOString(),
                days_overdue: Math.floor((today - loan.due_date) / (1000 * 60 * 60 * 24))
            }));

            res.status(200).json({ message: "Overdue loans fetched successfully", loans: overdueResponse });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async extendLoan(req, res) {
        try {
            const { extension_days } = req.body;
            const loan = await Loan.findById(req.params.id);

            if (!loan || loan.status === 'RETURNED') {
                return res.status(404).json({ message: "Loan not found or already returned" });
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

            res.status(200).json({ message: "Loan extended successfully", loan: extendedLoanResponse });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async aggregateActiveLoans(){
        const activeLoanUserIds = await Loan.aggregate([
            { $match: { status: 'ACTIVE' } },
            { $group: { _id: '$user_id', books_borrowed: { $sum: 1 } } },
            { $sort: { books_borrowed: -1 } },
            { $limit: 5 }
        ]);
        if (activeLoanUserIds.length === 0) {
            throw new Error("No active loans found");
        }
        return activeLoanUserIds;
    }

    static async aggregateLoanByBorrowCount(){
        const popularBookIds = await Loan.aggregate([
            { $group: { _id: '$book_id', borrow_count: { $sum: 1 } } },
            { $sort: { borrow_count: -1 } },
            { $limit: 5 }
        ]);
        if (popularBookIds.length === 0) {
            throw new Error("No popular books found");
        }
        return popularBookIds;
    }

    static async getStatsOverview(req, res) {
        try {
            const totalBooks = await BookController.getBookCount();
            const totalUsers = await UserController.getUserCount();
            const booksAvailable = await BookController.getAvailableBookCount();
            const booksBorrowed = await Loan.countDocuments({ status: 'ACTIVE' });
            const overdueLoans = await Loan.countDocuments({ status: 'ACTIVE', due_date: { $lt: new Date() } });
    
            
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
                message: "Stats overview fetched successfully",
                total_books: totalBooks,
                total_users: totalUsers,
                books_available: booksAvailable,
                books_borrowed: booksBorrowed,
                overdue_loans: overdueLoans,
                loans_today: loansToday,
                returns_today: returnsToday
            });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }
}

export default LoanController;