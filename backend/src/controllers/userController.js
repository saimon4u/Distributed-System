import User from '../models/User.js';
import LoanController from './loanController.js';

class UserController {
    static async createUser(req, res) {
        try {
            const { name, email, role } = req.body;
            const user = new User({ name, email, role });
            await user.save();
            res.status(201).json({message: "User created successfully", user});
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
            res.status(200).json({message: "User retrieved successfully", user});
        } catch (error) {
            res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    static async getActiveUsers(req, res){
        try {
            const activeUserIds = await LoanController.aggregateActiveLoans();
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

    static async getUserCount(){
        return await User.countDocuments();
    }
}

export default UserController;