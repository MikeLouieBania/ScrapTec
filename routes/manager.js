const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const authMiddlewareManager = require('../controllers/authMiddlewareManager'); // Import the middleware

router.get('/login', authMiddlewareManager.checkLoggedInRedirect, managerController.getLogin);
router.post('/login', authMiddlewareManager.checkLoggedInRedirect, managerController.managerLogin); 

router.get('/dashboard', authMiddlewareManager.requireLogin, managerController.getDashboard);
router.get('/manageDonation', authMiddlewareManager.requireLogin, managerController.getManageDonation); 
router.post('/updatePeripheral', authMiddlewareManager.requireLogin, managerController.postUpdatePeripheral);

// donation charts
router.get('/donationOverviewData', authMiddlewareManager.requireLogin, managerController.getDonationOverview);
router.get('/recentDonationsData', authMiddlewareManager.requireLogin, managerController.getRecentDonations);
router.get('/donationTrendsData', authMiddlewareManager.requireLogin, managerController.getDonationTrends);
// feedback charts
router.get('/recentFeedback', authMiddlewareManager.requireLogin, managerController.getRecentFeedback);
router.get('/feedbackSummary', authMiddlewareManager.requireLogin, managerController.getFeedbackSummary);
router.get('/feedbackTrends', authMiddlewareManager.requireLogin, managerController.getFeedbackTrends);
// reporting and analytics charts
router.get('/donationReportsData', authMiddlewareManager.requireLogin, managerController.getDonationReports);
router.get('/performanceMetricsData', authMiddlewareManager.requireLogin, managerController.getPerformanceMetrics);
// user and organization interaction charts
router.get('/userEngagement', authMiddlewareManager.requireLogin, managerController.getUserEngagement);
router.get('/organizationProfiles', authMiddlewareManager.requireLogin, managerController.getOrganizationProfiles);

router.post('/updateDonationStatus', authMiddlewareManager.requireLogin, managerController.updateDonationStatus);
router.get('/managerAccount', authMiddlewareManager.requireLogin, managerController.getManagerAccount);  

 
router.post('/updateAccount', authMiddlewareManager.requireLogin, managerController.postUpdateAccount); 
router.post('/changePassword', authMiddlewareManager.requireLogin, managerController.postChangePassword);


router.post('/logout', managerController.managerLogout);

module.exports = router;