const express = require('express');
const multer = require('multer');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/dashboard', userController.getDashboard);
router.get('/marketplace', userController.getMarketplace);
router.get('/useraccount', userController.getAccount)
router.get('/userdonations', userController.getDonations); 
router.post('/submitDonation', multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 }}).array('pcPhoto', 3), userController.submitDonation);
router.post('/logout', userController.logout); 

module.exports = router;
