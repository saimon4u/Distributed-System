import Book from '../models/Book.js';
import User from '../models/User.js';
import Loan from '../models/Loan.js';


class StatsController {
    static async getStatsOverview(req, res) {
        try {
            const totalBooks = await Book.countDocuments();
            const totalUsers = await User.countDocuments();
            const booksAvailable = await Book.aggregate([{ $match: { available_copies: { $gt: 0 } } }]);
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
                books_available: booksAvailable.length,
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

export default StatsController;