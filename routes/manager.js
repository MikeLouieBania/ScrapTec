const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const authMiddlewareManager = require('../controllers/authMiddlewareManager'); // Import the middleware

router.get('/login', authMiddlewareManager.checkLoggedInRedirect, managerController.getLogin);
router.post('/login', authMiddlewareManager.checkLoggedInRedirect, managerController.managerLogin); 

router.get('/dashboard', authMiddlewareManager.requireLogin, managerController.getDashboard);
router.get('/manageraccount', authMiddlewareManager.requireLogin, managerController.getManagerAccount);
router.get('/manageradddonation', authMiddlewareManager.requireLogin, managerController.getAddDonation);
router.post('/saveDonation', authMiddlewareManager.requireLogin, managerController.saveDonation);
router.post('/logout', managerController.managerLogout);


module.exports = router;