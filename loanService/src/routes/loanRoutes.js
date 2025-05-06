import express from 'express';
import LoanController from '../controllers/loanController.js';

const loanRouter = express.Router();


loanRouter.post('/', LoanController.issueBook);
loanRouter.post('/returns', LoanController.returnBook);
loanRouter.get('/overdue', LoanController.getOverdueLoans);
loanRouter.get('/stats', LoanController.getStatsOverview);
loanRouter.get('/:user_id', LoanController.getLoansByUser);
loanRouter.put('/:id/extend', LoanController.extendLoan);


export default loanRouter;