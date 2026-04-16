const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');

router.post('/', userController.register.bind(userController));
router.get('/', userController.getAll.bind(userController));
router.get('/:id', userController.getById.bind(userController));
router.delete('/:id', userController.delete.bind(userController));

module.exports = router;
