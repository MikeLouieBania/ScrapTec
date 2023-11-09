const express = require('express');
const multer = require('multer');
const router = express.Router();
const userController = require('../controllers/userController');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).array('photos', 5); // allow up to 5 photos
const uploadImageSeller = multer({ storage: storage }).single('image');
const uploadImageBuyer = multer({ storage: storage }).single('image');

 
router.get('/marketplace', userController.getMarketplace); 
router.get('/ads', userController.getAdsForCity);
router.post('/record-click', userController.postRecordAdClick);
router.get('/listing/:id', userController.getListing);
router.get('/createListing', userController.getCreateListing);
router.post('/createListing', upload, userController.postCreateListing);
router.get('/sellListing', userController.getSellingListings); 
router.post('/rate-buyer/:buyerId', userController.postRateBuyer);
router.get('/buyListing', userController.getBuyListings); 
router.post('/rateSeller', userController.postRateSeller);
router.get('/listing/:listingId/users', userController.getListingUsers);
router.post('/mark-as-sold/:listingId', userController.postMarkAsSold);
router.get('/inbox', userController.getInbox);
router.post('/send_message_buyer', uploadImageBuyer, userController.postSendMessageBuyer); 
router.get('/buyConversation/:listingId', userController.getBuyConversation);   
router.get('/loadMessagesBuyer/:conversationId/:messageId', userController.getLoadMessagesBuyer);
router.post('/send_message_seller', uploadImageSeller, userController.postSendMessageSeller); 
router.get('/sellConversation/:listingId/:conversationId', userController.getSellConversation);
router.get('/loadMessagesSeller/:conversationId/:messageId', userController.getLoadMessagesSeller);
router.get('/image/:id', userController.getImage);
router.get('/profile/:userId', userController.getViewUserProfile);
router.post('/saveListing/:id', userController.postSaveListing);
router.post('/unsaveListing/:id', userController.postUnsaveListing);
router.get('/savedListings', userController.getSavedListings);
router.get('/useraccount', userController.getAccount) 
router.post('/logout', userController.logout); 

module.exports = router;
