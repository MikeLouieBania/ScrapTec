const express = require('express'); 
const multer = require('multer');
const sharp = require('sharp');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
// Set up Multer storage
const storage = multer.memoryStorage(); // This will store the image in memory

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // Limit to 5MB
    },
});

router.get('/dashboard', organizationController.getDashboard); 
router.post('/submit-feedback', organizationController.submitFeedback);
router.post('/donationForm', organizationController.getDonationForm);  
router.post('/addDonation', organizationController.getAddDonation); 
router.get('/pledgeBasket', organizationController.getPledgeBasketPage);   
router.post('/confirmDonation', organizationController.getConfirmDonation);
router.get('/donationsList', organizationController.getDonationsList); 
router.get('/faq', organizationController.getFAQ);  
router.get('/account', organizationController.getAccount); 
router.get('/advertisements', organizationController.getAdvertisements); 
router.get('/spentPoints', organizationController.getSpentPoints);  
router.get('/advertise/:cityId', organizationController.getAdCity); 
router.post('/submitAdvertisement', upload.single('imageUrl'), organizationController.submitAdvertisement);
router.post('/logout', organizationController.logout); 

module.exports = router;
