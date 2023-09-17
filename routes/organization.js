const express = require('express'); 
const router = express.Router();
const organizationController = require('../controllers/organizationController');

router.get('/dashboard', organizationController.getDashboard);
router.post('/logout', organizationController.logout); 

module.exports = router;
