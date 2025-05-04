import express from 'express';
import StatsController from '../controllers/statsController.js';

const statsRouter = express.Router();

// statsRouter.get('/books/popular', StatsController.getPopularBooks);
// statsRouter.get('/users/active', StatsController.getActiveUsers);
statsRouter.get('/overview', StatsController.getStatsOverview);

export default statsRouter;