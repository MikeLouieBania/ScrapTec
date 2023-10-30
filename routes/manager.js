const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const authMiddlewareManager = require('../controllers/authMiddlewareManager'); // Import the middleware

router.get('/login', authMiddlewareManager.checkLoggedInRedirect, managerController.getLogin);
router.post('/login', authMiddlewareManager.checkLoggedInRedirect, managerController.managerLogin); 

router.get('/dashboard', authMiddlewareManager.requireLogin, managerController.getDashboard);
router.get('/manageDonation', authMiddlewareManager.requireLogin, managerController.getManageDonation);
router.post('/updateDonationStatus', authMiddlewareManager.requireLogin, managerController.updateDonationStatus);
router.get('/managerAccount', authMiddlewareManager.requireLogin, managerController.getManagerAccount);  
router.post('/logout', managerController.managerLogout);

module.exports = router;