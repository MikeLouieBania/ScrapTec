const express = require('express');
const router = express.Router(); 
const multer = require('multer');
const upload = multer();

const indexController = require('../controllers/indexController');
const authMiddlewareUser = require('../controllers/authMiddlewareUser');

router.get('/', authMiddlewareUser.checkLoggedInRedirect, indexController.getIndex); 
router.get('/login', authMiddlewareUser.checkLoggedInRedirect, indexController.getLogin); 
router.get('/signup', authMiddlewareUser.checkLoggedInRedirect, indexController.getSignup); 
router.get('/verify-otp', authMiddlewareUser.checkLoggedInRedirect, indexController.getVerifyOTP); 
router.post('/signup', upload.single('profilePicture'), indexController.registerUser);
router.post('/login', indexController.loginUser);
router.post('/verify-otp', indexController.verifyOTP);

module.exports = router;