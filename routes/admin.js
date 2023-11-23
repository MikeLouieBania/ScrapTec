const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddlewareAdmin = require('../controllers/authMiddlewareAdmin');

router.get('/login', authMiddlewareAdmin.checkLoggedInRedirect, adminController.getAdminLogin);
router.post('/login', adminController.postAdminLogin);

router.get('/dashboard', authMiddlewareAdmin.requireLogin, adminController.getAccount); 

router.get('/gender-distribution', authMiddlewareAdmin.requireLogin, adminController.getGenderDistribution);
router.get('/user-signups', authMiddlewareAdmin.requireLogin, adminController.getUserSignups);
router.get('/users-by-city', authMiddlewareAdmin.requireLogin, adminController.getUsersByCity);
router.get('/organizations-by-verification', authMiddlewareAdmin.requireLogin, adminController.getOrganizationsByVerification);
router.get('/organization-points-over-time', authMiddlewareAdmin.requireLogin, adminController.getOrganizationPointsOverTime);
router.get('/donations-over-time', authMiddlewareAdmin.requireLogin, adminController.getDonationsOverTime);
router.get('/donation-status-distribution', authMiddlewareAdmin.requireLogin, adminController.getDonationStatusDistribution);  
router.get('/average-rating-per-drop-point', authMiddlewareAdmin.requireLogin, adminController.getAverageRatingPerDropPoint); 
router.get('/ratings-distribution', authMiddlewareAdmin.requireLogin, adminController.getRatingsDistribution); 
router.get('/ad-interactions-over-time', authMiddlewareAdmin.requireLogin, adminController.getAdInteractionsOverTime); 
router.get('/points-spent-on-ads', authMiddlewareAdmin.requireLogin, adminController.getPointsSpentOnAds); 
router.get('/listings-per-category', authMiddlewareAdmin.requireLogin, adminController.getListingsPerCategory);
router.get('/sales-over-time', authMiddlewareAdmin.requireLogin, adminController.getSalesOverTime);
router.get('/messages-per-user', authMiddlewareAdmin.requireLogin, adminController.getMessagesPerUser);
router.get('/conversations-over-time', authMiddlewareAdmin.requireLogin, adminController.getConversationsOverTime);
router.get('/user-activity-heatmap', authMiddlewareAdmin.requireLogin, adminController.getUserActivityHeatMap);
router.get('/activity-sales-correlation', authMiddlewareAdmin.requireLogin, adminController.getActivitySalesCorrelation);

router.get('/organizationmanagement', authMiddlewareAdmin.requireLogin,  adminController.getOrganizationManagement); 
router.get('/viewdocuments', authMiddlewareAdmin.requireLogin,  adminController.viewDocuments);
router.get('/usermanagement', authMiddlewareAdmin.requireLogin,  adminController.getUserManagement); 
router.get('/managermanagement', authMiddlewareAdmin.requireLogin,  adminController.getManagerManagement); 

router.get('/managermanagement/logs/:managerId', authMiddlewareAdmin.requireLogin, adminController.getManagerActivities);
router.get('/managermanagement/donations/:managerId', authMiddlewareAdmin.requireLogin, adminController.getManagerDonations);
router.get('/managermanagement/feedbacks/:managerId', authMiddlewareAdmin.requireLogin, adminController.getManagerFeedbacks);


router.get('/droppointmanagement', authMiddlewareAdmin.requireLogin,  adminController.getDropPointManagement); 
router.get('/marketplacemanagement', authMiddlewareAdmin.requireLogin,  adminController.getMarketplaceManagement); 
router.get('/listings/:listingId/photos/:photoIndex', authMiddlewareAdmin.requireLogin, adminController.getListingPhoto);

router.post('/listings/:listingId/approve', authMiddlewareAdmin.requireLogin, adminController.postApproveListing);
router.post('/listings/:listingId/reject', authMiddlewareAdmin.requireLogin, adminController.postRejectListing);


router.post('/droppointmanagement', authMiddlewareAdmin.requireLogin,  adminController.createDropPoint);  
router.post('/managermanagement', authMiddlewareAdmin.requireLogin,  adminController.registerManager);
router.post('/assignManagerToDropPoint', authMiddlewareAdmin.requireLogin,  adminController.assignManagerToDropPoint); 
router.post('/removeManagerFromDropPoint', authMiddlewareAdmin.requireLogin,  adminController.removeManagerFromDropPoint);  
router.post('/updateOrganizationStatus', authMiddlewareAdmin.requireLogin,  adminController.updateOrganizationStatus); 
router.post('/updateDropPoint', authMiddlewareAdmin.requireLogin,  adminController.updateDropPoint);
router.post('/logout', adminController.adminLogout);

module.exports = router; 