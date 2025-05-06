import express from 'express';
import BookController from '../controllers/bookController.js';

const bookRouter = express.Router();

bookRouter.post('/', BookController.addBook);
bookRouter.get('/', BookController.searchBooks);
bookRouter.get('/count', BookController.getBookCount);
bookRouter.get('/available/count', BookController.getAvailableBookCount);
bookRouter.get('/available/:id', BookController.checkBookAvailability);
bookRouter.put('/increment/:id', BookController.incrementBookCopies);
bookRouter.put('/decrement/:id', BookController.decrementBookCopies);
bookRouter.get('/:id', BookController.getBookById);
bookRouter.put('/:id', BookController.updateBook);
bookRouter.delete('/:id', BookController.deleteBook);
bookRouter.get('/stats/popular', BookController.getPopularBooks);

export default bookRouter;