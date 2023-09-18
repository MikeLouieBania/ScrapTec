const express = require('express'); 
const multer = require('multer');
const router = express.Router();
const organizationController = require('../controllers/organizationController');

router.get('/dashboard', organizationController.getDashboard);
router.get('/donations', organizationController.getDonations); 
router.post('/donationForm', organizationController.getDonationForm);  
router.get('/account', organizationController.getAccount); 
router.post('/logout', organizationController.logout); 

module.exports = router;
