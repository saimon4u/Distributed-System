import express from 'express';
import BookController from '../controllers/bookController.js';

const bookRouter = express.Router();

bookRouter.post('/', BookController.addBook);
bookRouter.get('/', BookController.searchBooks);
bookRouter.get('/:id', BookController.getBookById);
bookRouter.put('/:id', BookController.updateBook);
bookRouter.delete('/:id', BookController.deleteBook);
// bookRouter.get('/stats/popular', BookController.getPopularBooks);

export default bookRouter;