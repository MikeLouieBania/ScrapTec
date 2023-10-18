const express = require('express');
const multer = require('multer');
const router = express.Router();
const userController = require('../controllers/userController');
 
router.get('/marketplace', userController.getMarketplace);
router.get('/useraccount', userController.getAccount) 
router.post('/logout', userController.logout); 

module.exports = router;
