const express = require('express'); 
const multer = require('multer');
const router = express.Router();
const organizationController = require('../controllers/organizationController');

router.get('/dashboard', organizationController.getDashboard); 
router.post('/donationForm', organizationController.getDonationForm);  
router.post('/addDonation', organizationController.getAddDonation); 
router.get('/pledgeBasket', organizationController.getPledgeBasketPage);   
router.post('/confirmDonation', organizationController.getConfirmDonation);
router.get('/donationsList', organizationController.getDonationsList); 
router.get('/account', organizationController.getAccount); 
router.post('/logout', organizationController.logout); 

module.exports = router;
