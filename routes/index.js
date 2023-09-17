const express = require('express');
const router = express.Router(); 
const multer = require('multer');
const upload = multer();

const storage = multer.memoryStorage();
const fileupload = multer({ storage: storage });

const indexController = require('../controllers/indexController');
const authMiddlewareUser = require('../controllers/authMiddlewareUser');
const authMiddlewareOrganization = require('../controllers/authMiddlewareOrganization');

router.get('/', authMiddlewareUser.checkLoggedInRedirect, authMiddlewareOrganization.checkLoggedInRedirect, indexController.getIndex); 
router.get('/login', authMiddlewareUser.checkLoggedInRedirect, authMiddlewareOrganization.checkLoggedInRedirect, indexController.getLogin); 
router.get('/signup', authMiddlewareUser.checkLoggedInRedirect, authMiddlewareOrganization.checkLoggedInRedirect, indexController.getSignup); 
router.get('/verify-otp', authMiddlewareUser.checkLoggedInRedirect, indexController.getVerifyOTP); 
router.post('/user-signup', upload.single('profilePicture'), indexController.registerUser);
router.post('/organization-signup', fileupload.single('documentUpload'), indexController.registerOrganization);
router.post('/login', indexController.login);
router.post('/verify-otp', indexController.verifyOTP);

module.exports = router;