const express = require('express'); 
const multer = require('multer');
const router = express.Router();
const organizationController = require('../controllers/organizationController');

router.get('/dashboard', organizationController.getDashboard);
router.get('/donations', organizationController.getDonations); 
router.get('/make-donation', organizationController.getMakeDonations);
router.get('/account', organizationController.getAccount);
router.post('/submitDonation', multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 }}).array('pcPhoto', 3), organizationController.submitDonation);
router.post('/logout', organizationController.logout); 

module.exports = router;
