const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/dashboard', adminController.getDashboard); 
router.get('/usermanagement', adminController.getUserManagement); 
router.get('/managermanagement', adminController.getManagerManagement); 
router.get('/droppointmanagement', adminController.getDropPointManagement); 
router.post('/droppointmanagement', adminController.createDropPoint);  
router.post('/managermanagement', adminController.registerManager);
router.post('/assignManagerToDropPoint', adminController.assignManagerToDropPoint); 

module.exports = router; 