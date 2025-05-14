import User from '../models/User.js';
import axios from 'axios';
import CircuitBreaker from '../utils/circuitBreaker.js';

const loanServiceBreaker = new CircuitBreaker({
    request: axios,
    failureThreshold: 3,
    timeout: 5000,
    resetTimeout: 30000,
    fallback: () => ({
        status: 503,
        data: { message: 'Loan service unavailable', active_loans: [] }
    })
});

class UserController {
    static loanServiceBreaker = loanServiceBreaker;

    static async createUser(req, res) {
        try {
            const { name, email, role } = req.body;
            const user = new User({ name, email, role });
            await user.save();
            res.status(201).json({ message: "User created successfully", user });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async getUserById(req, res) {
        try {
            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            res.status(200).json({ message: "User retrieved successfully", user });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async getActiveUsers(req, res) {
        try {
            if (!UserController.loanServiceBreaker) {
                throw new Error('Loan service circuit breaker not initialized');
            }

            const activeLoansResponse = await UserController.loanServiceBreaker.get(
                `${process.env.LOAN_BACKEND_BASE_URI}/api/loans/aggregate/active_loans`
            );
            if (activeLoansResponse.status !== 200) {
                return res.status(activeLoansResponse.status).json({
                    message: activeLoansResponse.data.message || 'Error fetching active loans'
                });
            }

            const activeUserIds = activeLoansResponse.data.active_loans;
            const userIds = activeUserIds.map(item => item._id);
            const users = await User.find({ _id: { $in: userIds } });
            const userMap = new Map(users.map(user => [user._id.toString(), user]));
            const activeUsersWithDetails = activeUserIds
                .map(item => {
                    const user = userMap.get(item._id.toString());
                    if (!user) {
                        console.warn(`User not found for user_id: ${item._id}`);
                        return null;
                    }
                    return {
                        user_id: item._id,
                        name: user.name,
                        books_borrowed: item.books_borrowed
                    };
                })
                .filter(user => user !== null);

            res.status(200).json({ message: "Active users fetched successfully", activeUsers: activeUsersWithDetails });
        } catch (error) {
            console.error(`Error fetching active users: ${error.message}`);
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async getUserCount(req, res) {
        try {
            const count = await User.countDocuments();
            res.status(200).json({ message: "User count fetched successfully", count });
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }
}

export default UserController;