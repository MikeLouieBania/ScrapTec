const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddlewareAdmin = require('../controllers/authMiddlewareAdmin');

<<<<<<< Updated upstream
router.get('/dashboard', adminController.getDashboard); 
router.get('/usermanagement', adminController.getUserManagement); 
router.get('/managermanagement', adminController.getManagerManagement); 
router.get('/droppointmanagement', adminController.getDropPointManagement); 
router.post('/droppointmanagement', adminController.createDropPoint);  
router.post('/managermanagement', adminController.registerManager);
router.post('/assignManagerToDropPoint', adminController.assignManagerToDropPoint); 
=======
router.get('/login', authMiddlewareAdmin.checkLoggedInRedirect, adminController.getAdminLogin);
router.post('/login', adminController.postAdminLogin);
router.get('/dashboard', authMiddlewareAdmin.requireLogin, adminController.getAccount); 
router.get('/organizationmanagement', authMiddlewareAdmin.requireLogin,  adminController.getOrganizationManagement); 
router.get('/viewdocuments', authMiddlewareAdmin.requireLogin,  adminController.viewDocuments);
router.get('/usermanagement', authMiddlewareAdmin.requireLogin,  adminController.getUserManagement); 
router.get('/managermanagement', authMiddlewareAdmin.requireLogin,  adminController.getManagerManagement); 
router.get('/droppointmanagement', authMiddlewareAdmin.requireLogin,  adminController.getDropPointManagement); 
router.post('/droppointmanagement', authMiddlewareAdmin.requireLogin,  adminController.createDropPoint);  
router.post('/managermanagement', authMiddlewareAdmin.requireLogin,  adminController.registerManager);
router.post('/assignManagerToDropPoint', authMiddlewareAdmin.requireLogin,  adminController.assignManagerToDropPoint); 
router.post('/removeManagerFromDropPoint', authMiddlewareAdmin.requireLogin,  adminController.removeManagerFromDropPoint);  
router.post('/updateOrganizationStatus', authMiddlewareAdmin.requireLogin,  adminController.updateOrganizationStatus); 
router.post('/updateDropPoint', authMiddlewareAdmin.requireLogin,  adminController.updateDropPoint);
router.post('/logout', adminController.adminLogout);
>>>>>>> Stashed changes

module.exports = router; 