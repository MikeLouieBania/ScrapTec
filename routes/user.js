const express = require('express');
const multer = require('multer');
const router = express.Router();
const userController = require('../controllers/userController');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).array('photos', 5); // allow up to 5 photos

 
router.get('/marketplace', userController.getMarketplace); 
router.get('/listing/:id', userController.getListing);
router.get('/createListing', userController.getCreateListing);
router.post('/createListing', upload, userController.postCreateListing);
router.get('/sellListing', userController.getSellingListings); 
router.get('/inbox', userController.getInbox);
router.post('/send_message_buyer', userController.postSendMessageBuyer); 
router.get('/buyConversation/:listingId', userController.getBuyConversation);
router.post('/send_message_seller', userController.postSendMessageSeller); 
router.get('/sellConversation/:listingId/:conversationId', userController.getSellConversation);
router.get('/useraccount', userController.getAccount) 
router.post('/logout', userController.logout); 

module.exports = router;
