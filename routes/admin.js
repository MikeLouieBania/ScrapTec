const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/dashboard', adminController.getDashboard); 
router.get('/organizationmanagement', adminController.getOrganizationManagement); 
router.get('/viewdocuments', adminController.viewDocuments);
router.get('/usermanagement', adminController.getUserManagement); 
router.get('/managermanagement', adminController.getManagerManagement); 
router.get('/droppointmanagement', adminController.getDropPointManagement); 
router.post('/droppointmanagement', adminController.createDropPoint);  
router.post('/managermanagement', adminController.registerManager);
router.post('/assignManagerToDropPoint', adminController.assignManagerToDropPoint); 
router.post('/removeManagerFromDropPoint', adminController.removeManagerFromDropPoint);  
router.post('/updateOrganizationStatus', adminController.updateOrganizationStatus); 

module.exports = router; 