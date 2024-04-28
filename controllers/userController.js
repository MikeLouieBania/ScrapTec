const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const gridfsService = require('./gridfsService');

function getMimeType(extension) {
  switch ((extension || "").toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'data:image/jpeg;base64,';
    case 'png':
      return 'data:image/png;base64,';
    case 'gif':
      return 'data:image/gif;base64,';
    default:
      return 'data:image/png;base64,'; // default to PNG or any other type you prefer
  }
}
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

async function handleImageUpload(req) {
  if (req.file) {
    try {
      const fileId = await gridfsService.uploadFile(req.file.buffer, req.file.originalname);
      return fileId.toString(); // Return the file ID as a string
    } catch (err) {
      console.error('Error uploading image to GridFS:', err);
      throw new Error('Internal Server Error'); // Throw an error to be caught by the caller
    }
  }
  return null; // Return null if no file was uploaded
}

async function deactivateExpiredAds() {
  const now = new Date();
  const expiredAds = await prisma.advertisement.findMany({
    where: {
      isActive: true,
      expiryDate: {
        lt: now, // 'lt' stands for 'less than'
      },
    },
  });

  // Batch update to set isActive to false for all expired ads
  const updatePromises = expiredAds.map(ad =>
    prisma.advertisement.update({
      where: { id: ad.id },
      data: { isActive: false },
    })
  );

  await Promise.all(updatePromises);
}

// Helper function to recalculate the exposure frequency
async function recalculateExposureFrequency() {
  const activeAdCount = await prisma.advertisement.count({ where: { isActive: true } });
  // Assuming each user session will show 5 ads at a time, calculate how many rotations are needed per ad per day
  const rotationsNeededPerAdPerDay = 24 * 60 / (activeAdCount / 5);
  return Math.max(1, Math.floor(rotationsNeededPerAdPerDay));
}

// Modified getRankedAds function to incorporate fair exposure logic
async function getRankedAds(cityId, takeLimit) {
  // Fetch all active advertisements for the city
  const allActiveAds = await prisma.advertisement.findMany({
    where: {
      cityId: cityId,
      isActive: true,
    },
    include: {
      organization: true, // Include the organization to access lifetimePoints
    },
    orderBy: [
      {
        organization: {
          lifetimePoints: 'desc', // Primary sorting by lifetime points
        },
      },
      {
        startDate: 'asc', // Secondary sorting by creation date
      },
    ],
  });

  // Calculate the exposure frequency for each ad
  const exposureFrequency = await recalculateExposureFrequency();

  // Implement a round-robin mechanism to fairly expose ads
  const lastIndex = await getLastDisplayedIndex(cityId);
  let adsToDisplay = [];
  let index = lastIndex;

  // Adjust the takeLimit based on the number of active ads
  takeLimit = Math.min(takeLimit, allActiveAds.length);

  for (let i = 0; i < takeLimit; i++) {
    adsToDisplay.push(allActiveAds[index]);
    index = (index + 1) % allActiveAds.length; // Move to the next ad
  } 

  // Update the last displayed index
  await setLastDisplayedIndex(cityId, index);

  return adsToDisplay;
}

// This function retrieves the last displayed ad index from a persistent storage
async function getLastDisplayedIndex(cityId) {
  const record = await prisma.keyValueStore.findFirst({
    where: { key: `lastIndex_${cityId}` },
  });
  return record ? parseInt(record.value) : 0;
}

// This function updates the last displayed ad index in a persistent storage
async function setLastDisplayedIndex(cityId, index) {
  await prisma.keyValueStore.upsert({
    where: { key: `lastIndex_${cityId}` },
    update: { value: index.toString() },
    create: { key: `lastIndex_${cityId}`, value: index.toString() },
  });
}

module.exports = {
  async getMarketplace(req, res) {
    try {
      const currentUserId = req.session.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      
    // Fetch the full details of the currently logged-in user
    const fullUserDetails = await prisma.user.findUnique({
      where: { id: currentUserId }
    });

    // Check if the user details are available
    if (!fullUserDetails) {
      throw new Error("User not found");
    }

    // Create a new object with complete user details
    const userDetails = {
      firstName: fullUserDetails.firstName,
      lastName: fullUserDetails.lastName,
      email: fullUserDetails.email,
      // You can include other details if necessary
    };
       
      // Fetch IDs of listings reported by the current user
      const reportedListings = await prisma.report.findMany({
        where: { reportedById: currentUserId },
        select: { listingId: true }
      });
      const reportedListingIds = reportedListings.map(report => report.listingId);
  
  
      // Building the where clause for filters
      let whereClause = {
        userId: { not: currentUserId },
        id: { notIn: reportedListingIds },
        status: { notIn: ["SOLD", "REJECTED"] },
      };
  
      // Search filter
      if (req.query.search) {
        whereClause.title = { contains: req.query.search, mode: 'insensitive' };
      }
  
      // Price range filter
      if (req.query['min-price'] || req.query['max-price']) {
        whereClause.price = {};
        if (req.query['min-price']) whereClause.price.gte = parseFloat(req.query['min-price']);
        if (req.query['max-price']) whereClause.price.lte = parseFloat(req.query['max-price']);
      }
  
      // Condition and category filters
      if (req.query.condition) {
        whereClause.conditionId = { in: Array.isArray(req.query.condition) ? req.query.condition : [req.query.condition] };
      }
      if (req.query.category) {
        whereClause.categoryId = { in: Array.isArray(req.query.category) ? req.query.category : [req.query.category] };
      }
  
      // Fetch conditions and categories
      const [conditions, categories] = await Promise.all([
        prisma.condition.findMany(),
        prisma.category.findMany()
      ]);
  
      // Fetch filtered listings
      const listings = await prisma.listing.findMany({
        where: whereClause,
        include: { photos: true },
        skip: skip,
        take: limit,
      });
  
      // Convert each listing's photos' imageUrl to Base64. 
      listings.forEach(listing => {
        if (listing.photos && listing.photos.length > 0) {
          listing.photos.forEach(photo => {
            if (photo.imageUrl) {
              // Get the MIME type based on the extension (assuming photo has a property 'extension')
              const mimeType = getMimeType(photo.extension);
              photo.imageUrl = mimeType + photo.imageUrl.toString('base64');
            }
          });
        }
      });
  
      // Fetch total count of listings for pagination
      const totalListings = await prisma.listing.count({ where: whereClause });
  
      // Calculate total pages
      const totalPages = Math.ceil(totalListings / limit);

      // Fetch conversations where the current user is a participant
      const conversations = await prisma.conversation.findMany({
        where: {
          OR: [
            { user1Id: currentUserId },
            { user2Id: currentUserId }
          ]
        },
        include: {
          messages: true // Include all messages
        }
      });

      // Calculate the total number of unread messages received by the user
      let totalUnreadMessages = 0;
      conversations.forEach(conversation => {
        const unreadReceivedMessages = conversation.messages.filter(message => 
          !message.read && message.senderId !== currentUserId
        );
        totalUnreadMessages += unreadReceivedMessages.length;
      });

      // Fetch sales where the current user is the buyer
      const sales = await prisma.sale.findMany({
        where: {
          buyerId: currentUserId,
        },
        include: {
          listing: true, // Including listing to check for related ratings
          rating: true   // Including rating information
        }
      });

      // Count sales where feedback (rating) is pending
      let totalFeedbackBuyingNotifications = sales.reduce((count, sale) => {
        // Check if there's a rating associated with this sale given by the buyer
        const feedbackGiven = sale.rating.some(rating => rating.raterId === currentUserId);
        return count + (feedbackGiven ? 0 : 1);
      }, 0);
      
      
      // Fetch Sales for Listings Owned by the User
      const userSales = await prisma.sale.findMany({
        where: {
          listing: {
            userId: currentUserId, // Listings where the user is the seller
            status: "SOLD"        // Considering only sold listings
          }
        },
        include: {
          listing: true,
          rating: true // Include ratings associated with the sale
        }
      });

      // Count sales where the seller's feedback to the buyer is pending
      let totalFeedbackSellerNotifications = userSales.reduce((count, sale) => {
        // Check if the seller (current user) has given feedback
        const feedbackGivenBySeller = sale.rating.some(rating => 
          rating.raterId === currentUserId && rating.type === "SELLER_TO_BUYER"
        );
        return count + (feedbackGivenBySeller ? 0 : 1);
      }, 0);


      // Render the marketplace page
      res.render('user/marketplace', {
        user: req.session.user,
        userDetails: userDetails, 
        listings: listings,
        conditions: conditions,
        categories: categories,
        currentPage: page,
        totalPages: totalPages,
        totalUnreadMessages,
        totalFeedbackBuyingNotifications,
        totalFeedbackSellerNotifications
      });
  
    } catch (error) {
      console.error("Error fetching marketplace:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getAdsForCity(req, res) {
    try {
      // First, deactivate expired ads
      await deactivateExpiredAds();

      const userId = req.session.user.id;

      // Find the user and include the city to get the cityId
      const userWithCity = await prisma.user.findUnique({
        where: { id: userId },
        include: { city: true }
      });

      if (!userWithCity || !userWithCity.city) {
        return res.status(404).send("User or user's city not found.");
      }

      const cityId = userWithCity.city.id;

      // Fetch ranked advertisements for the user's city, 5 at a time
      const advertisements = await getRankedAds(cityId, 5);

      // Convert each advertisement's imageUrl to Base64
      const adsWithBase64Images = advertisements.map(ad => {
        if (ad.imageUrl) { 
          const mimeType = getMimeType('png'); // Default to 'png' or any other type you prefer
          const base64Image = Buffer.from(ad.imageUrl).toString('base64');
          return {
            ...ad,
            imageUrl: `${mimeType}${base64Image}`,
            adId: ad.id, // Include the ad's unique identifier
          };
        }
        return ad;
      });

      // Return the processed ads as JSON
      res.json({ ads: adsWithBase64Images });
    } catch (error) {
      console.error("Error fetching ads for city:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  
  async postRecordAdClick(req, res) {
    try {
      const { adId } = req.body;
      // Record the click in the database
      await prisma.adInteraction.create({
        data: {
          advertisementId: adId,
          clickedAt: new Date(), // Record the current time as the click time
        },
      });
      res.status(200).send('Click recorded');
    } catch (error) {
      console.error("Error recording ad click:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  
  async getListing(req, res) {
    try {
      const listingId = req.params.id;  // Get the listing ID from the URL parameter
      const userId = req.session.user.id;  // Get the current user's ID from the session

      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          photos: true,
          category: true,  // Include category details
          condition: true,  // Include condition details
          user: true  // Include user details
        }  // Include photos of the listing
      });

      if (!listing) {
        return res.status(404).send("Listing not found");
      }

      // Convert photo URLs to Base64 (just like you did in the marketplace controller)
      listing.photos.forEach(photo => {
        if (photo.imageUrl) {
          const mimeType = getMimeType(photo.extension);
          photo.imageUrl = mimeType + photo.imageUrl.toString('base64');
        }
      });

      const existingConversation = await prisma.conversation.findFirst({
        where: {
          OR: [
            { user1Id: userId, user2Id: listing.userId, listingId: listingId },
            { user1Id: listing.userId, user2Id: userId, listingId: listingId }
          ]
        }
      });

      // Check if the listing has been saved by the current user
      const existingSavedListing = await prisma.savedListing.findFirst({
        where: {
          userId: userId,
          listingId: listingId
        }
      });

      res.render('user/listing', {
        user: req.session.user,
        listing: listing,
        existingConversation: existingConversation,
        existingSavedListing: existingSavedListing // Pass this to the view to determine whether to show the save button
      });

    } catch (error) {
      console.error("Error fetching listing:", error);
      res.status(500).send("Internal Server Error");
    }
  }, 

  async postReportListing(req, res) {
    try {
        const { reportReasons, listingId } = req.body;
        const reportedById = req.session.user.id;

        // Create a new report
        await prisma.report.create({
            data: {
                listingId: listingId,
                reportedById: reportedById,
                reason: reportReasons.join(', '), // Join the reasons into a single string 
            }
        });

        res.json({ success: true, message: 'Report submitted successfully' });
    } catch (error) {
        console.error("Error submitting report:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  async getCreateListing(req, res) {
    try {
      // Fetch categories and conditions to populate the dropdowns
      const categories = await prisma.category.findMany();
      const conditions = await prisma.condition.findMany();

      // Get user's ID from the session
      const userId = req.session.user.id;

      res.render('user/createListing', { categories, conditions, userId });
    } catch (error) {
      console.error("Error loading create listing page:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async postCreateListing(req, res) {
    try {
      const { title, description, categoryId, conditionId, location, price } = req.body;

      // Ensure categoryId is provided
      if (!categoryId) {
        return res.status(400).send("Category ID is required");
      }

      // First, create the listing
      const newListing = await prisma.listing.create({
        data: {
          title: title,
          description: description,
          categoryId: categoryId,
          conditionId: conditionId,
          location: location,
          price: parseFloat(price),
          userId: req.session.user.id
        }
      });

      // If photos are uploaded, save them and associate with the created listing
      if (req.files) {
        for (let file of req.files) {
          const imgBase64 = file.buffer.toString('base64');

          await prisma.photo.create({
            data: {
              imageUrl: imgBase64,
              listingId: newListing.id
            }
          });
        }
      }

      res.redirect('/user/marketplace');
    } catch (error) {
      console.error("Error creating listing:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getEditListing(req, res) {
    try {
      const listingId = req.params.listingId;
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        include: {
          photos: true,
          category: true,
          condition: true,
        },
      });
  
      if (!listing) {
        return res.status(404).send("Listing not found");
      }
  
      // Prepend the MIME type to each image's base64 data, if available
      if (listing.photos && listing.photos.length > 0) {
        listing.photos.forEach(photo => {
          if (photo.imageUrl) {
            // Assuming you store the image extension in the photo object
            const mimeType = getMimeType(photo.extension);
            photo.imageUrl = mimeType + photo.imageUrl.toString('base64');
          }
        });
      }
  
      const categories = await prisma.category.findMany();
      const conditions = await prisma.condition.findMany();
      const userId = req.session.user.id;
  
      res.render('user/editListing', { 
        listing, 
        categories, 
        conditions, 
        userId
      });
    } catch (error) {
      console.error("Error loading edit listing page:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async postUpdateListing(req, res) {
    try {
      const { title, description, categoryId, conditionId, location, price } = req.body;
      const listingId = req.params.listingId;
  
      // Ensure categoryId is provided
      if (!categoryId) {
        return res.status(400).send("Category ID is required");
      }
  
      // Update the listing in the database
      const updatedListing = await prisma.listing.update({
        where: { id: listingId },
        data: {
          title: title,
          description: description,
          categoryId: categoryId,
          conditionId: conditionId,
          location: location,
          price: parseFloat(price),
        },
      });
  
      res.redirect('/user/sellListing');
    } catch (error) {
      console.error("Error updating listing:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async updateListingImages(req, res) {
    try { 
        const listingId = req.params.listingId;
        const newImages = req.files;

        // Correctly handle parsing of removedImages
        let removedImages = [];
        if (req.body.removedImages) {
            removedImages = JSON.parse(req.body.removedImages);
        }

        const listing = await prisma.listing.findUnique({
            where: { id: listingId },
            include: { photos: true },
        });

        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        // Handle new images
        const newPhotos = newImages.map(image => {
            const base64String = image.buffer.toString('base64');
            return {
                imageUrl: base64String,
                listingId: listing.id,
            };
        });

        if (newPhotos.length > 0) {
            await prisma.photo.createMany({ data: newPhotos });
        }

        // Remove specified images from the database
        if (removedImages.length > 0) {
            await prisma.photo.deleteMany({
                where: {
                    id: { in: removedImages },
                    listingId: listingId
                }
            });
        } 

        res.redirect('/user/sellListing');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
  },

  async deleteListing(req, res) {
    try {
        const listingId = req.params.listingId;

        // Delete associated photos first
        await prisma.photo.deleteMany({
            where: { listingId: listingId }
        });

        // Then delete the listing
        await prisma.listing.delete({
            where: { id: listingId }
        });

        res.status(200).json({ message: 'Listing deleted successfully' });
    } catch (error) {
        console.error('Error deleting listing:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
  },
  
  async getSellingListings(req, res) {
    try {
      const userId = req.session.user.id;
           
      // Fetch the full details of the currently logged-in user
      const fullUserDetails = await prisma.user.findUnique({
        where: { id: userId }
      });

      // Check if the user details are available
      if (!fullUserDetails) {
        throw new Error("User not found");
      }

      // Create a new object with complete user details
      const userDetails = {
        firstName: fullUserDetails.firstName,
        lastName: fullUserDetails.lastName,
        email: fullUserDetails.email,
        // You can include other details if necessary
      }; 

      const sellingListings = await prisma.listing.findMany({
        where: {
          userId: userId,
        },
        include: {
          photos: true,
          category: true,
          condition: true,
          sales: {
            include: {
              buyer: true,
              rating: true // Include ratings
            }
          }
        },
      });

      const enhancedListings = sellingListings.map(listing => {
        const sales = listing.sales.map(sale => ({
          ...sale,
          buyerRatings: sale.rating.filter(r => r.type === "SELLER_TO_BUYER") || [] // Filter for SELLER_TO_BUYER ratings
        }));
        return { ...listing, sales };
      });

      sellingListings.forEach(listing => {
        if (listing.photos && listing.photos.length > 0) {
          listing.photos.forEach(photo => {
            if (photo.imageUrl) {
              // Assuming you store the image extension in the photo object
              const mimeType = getMimeType(photo.extension);
              photo.imageUrl = mimeType + photo.imageUrl.toString('base64');
            }
          });
        }
      });

      res.render('user/sellListing', { sellingListings: enhancedListings, getMimeType, 
        userDetails: userDetails,  });
    } catch (error) {
      console.error('Error fetching selling listings:', error);
      res.status(500).send('Internal Server Error');
    }
  },

  async postRateBuyer(req, res) {
    try {
      const { value, comment, saleId, buyerId } = req.body;
      const sellerId = req.session.user.id;

      if (!value || !comment || !buyerId || !saleId) {
        return res.status(400).send('All fields are required');
      }

      const numericValue = parseInt(value);
      if (isNaN(numericValue) || numericValue < 1 || numericValue > 5) {
        return res.status(400).send('Invalid rating value');
      }

      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { rating: true, listing: true } // Include the related listing
      });
      if (!sale) {
        return res.status(404).send('Sale not found');
      }

      const actualSellerId = sale.listing.userId; // Get the seller ID from the related listing
      if (actualSellerId !== sellerId) {
        return res.status(403).send('You are not authorized to rate this buyer');
      }

      const alreadyRated = sale.rating.some(rating => rating.raterId === sellerId && rating.type === "SELLER_TO_BUYER");
      if (alreadyRated) {
        return res.status(400).send('You have already rated this buyer for this transaction');
      }

      const newRating = await prisma.rating.create({
        data: {
          value: numericValue,
          comment: comment.trim(),
          saleId: saleId,
          raterId: sellerId,
          rateeId: buyerId,
          type: "SELLER_TO_BUYER"
        }
      });

      res.redirect('/user/sellListing');
    } catch (error) {
      console.error('Error submitting buyer rating:', error);
      res.status(500).send('Internal Server Error');
    }
  },

  async getBuyListings(req, res) {
    try {
      const userId = req.session.user.id;

      // Fetch the full details of the currently logged-in user
      const fullUserDetails = await prisma.user.findUnique({
        where: { id: userId }
      });

      // Check if the user details are available
      if (!fullUserDetails) {
        throw new Error("User not found");
      }

      // Create a new object with complete user details
      const userDetails = {
        firstName: fullUserDetails.firstName,
        lastName: fullUserDetails.lastName,
        email: fullUserDetails.email,
        // You can include other details if necessary
      };

      // Fetch listings bought by the user
      const userPurchases = await prisma.user.findUnique({
        where: {
          id: userId
        },
        select: {
          purchases: {
            select: {
              id: true,  // Fetching the sale.id
              listing: {
                include: {
                  photos: true,
                  category: true,
                  condition: true,
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true
                    }
                  }
                }
              },
              rating: true  // Include ratings related to the sale
            }
          }
        }
      });

      const boughtListings = userPurchases.purchases.map(purchase => {
        const listing = purchase.listing;
        listing.saleId = purchase.id.toString();
        listing.ratings = purchase.rating.filter(rating => rating.type === "BUYER_TO_SELLER");
        return listing;
      });

      // Convert image bytes to base64 string
      boughtListings.forEach(listing => {
        if (listing.photos && listing.photos.length > 0) {
          listing.photos.forEach(photo => {
            if (photo.imageUrl) {
              photo.imageUrl = "data:image/png;base64," + photo.imageUrl.toString('base64');
            }
          });
        }
      });

      res.render('user/buyListing', { boughtListings, userId, userDetails: userDetails,  });
    } catch (error) {
      console.error('Error fetching bought listings:', error);
      res.status(500).send('Internal Server Error');
    }
  },

  async postRateSeller(req, res) {
    try {
      const { value, comment, sellerId, saleId } = req.body;
      const buyerId = req.session.user.id; // Assuming you have the buyer's ID in the session

      if (!value || !comment || !sellerId || !saleId) {
        return res.status(400).send('All fields are required');
      }

      // Validate rating value
      const numericValue = parseInt(value);
      if (isNaN(numericValue) || numericValue < 1 || numericValue > 5) {
        return res.status(400).send('Invalid rating value');
      }

      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { rating: true } // Include existing ratings to check if already rated
      });

      if (!sale) {
        return res.status(404).send('Sale not found');
      }

      // Verify the sale belongs to the logged-in buyer
      if (sale.buyerId !== buyerId) {
        return res.status(403).send('You are not authorized to rate this seller');
      }

      // Check if buyer has already rated the seller for this sale
      const alreadyRated = sale.rating.some(rating => rating.raterId === buyerId);
      if (alreadyRated) {
        return res.status(400).send('You have already rated this seller for this transaction');
      }

      const newRating = await prisma.rating.create({
        data: {
          value: numericValue,
          comment: comment.trim(),
          sale: { connect: { id: saleId } }, // Connect the sale
          rater: { connect: { id: buyerId } }, // Connect the buyer who is giving the rating
          ratee: { connect: { id: sellerId } }, // Connect the seller receiving the rating
          type: "BUYER_TO_SELLER" // Specify the type of rating
        }
      });

      res.redirect('/user/buyListing');
    } catch (error) {
      console.error('Error submitting seller rating:', error);
      res.status(500).send('Internal Server Error');
    }
  },

  async getListingUsers(req, res) {
    try {
      const listingId = req.params.listingId;
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
      });
      if (!listing) {
        return res.status(404).json({ message: 'Listing not found' });
      }
      const sellerId = listing.userId; // Get the seller's user ID

      const conversations = await prisma.conversation.findMany({
        where: {
          listingId: listingId,
          OR: [
            { user1Id: { not: sellerId } },
            { user2Id: { not: sellerId } },
          ],
        },
        include: {
          user1: true,
          user2: true,
        },
      });

      const buyers = conversations.map(conv => {
        const user = (conv.user1Id !== sellerId ? conv.user1 : conv.user2);
        return { ...user, conversationId: conv.id };  // Include the conversation ID
      });
      res.json(buyers);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  },

  async postMarkAsSold(req, res) {
    try {
      const { listingId } = req.params;
      const { buyerId, conversationId } = req.body;

      if (!buyerId || !conversationId) {
        return res.status(400).json({ message: 'Missing required fields: buyerId or conversationId' });
      }

      // Start a transaction to ensure data consistency
      const result = await prisma.$transaction(async (prisma) => {
        // Find the listing with the associated user
        const listing = await prisma.listing.findUnique({
          where: { id: listingId },
          include: { user: true }
        });

        if (!listing) {
          return res.status(404).json({ message: 'Listing not found' });
        }

        if (listing.status === "SOLD") {
          return res.status(400).json({ message: 'Listing is already sold' });
        }

        // Ensure that the logged-in user is the seller of the listing
        const userId = req.session.user.id;
        if (listing.userId !== userId) {
          return res.status(403).json({ message: 'You are not authorized to mark this listing as sold' });
        }

        // Find the buyer
        const buyer = await prisma.user.findUnique({
          where: { id: buyerId }
        });

        if (!buyer) {
          return res.status(404).json({ message: 'Buyer not found' });
        }

        // Create a sale record
        const sale = await prisma.sale.create({
          data: {
            buyer: { connect: { id: buyerId } },
            listing: { connect: { id: listingId } },
            salePrice: listing.price,
            conversation: { connect: { id: conversationId } }
          }
        });

        // Update the listing's status
        await prisma.listing.update({
          where: { id: listingId },
          data: { status: "SOLD" }
        });

        return { sale, buyer };
      });

      res.json(result);
    } catch (error) {
      console.error('Error marking listing as sold:', error);
      res.status(500).send('Internal Server Error');
    }
  },

  async getInbox(req, res) {
    try {
      const userId = req.session.user.id;

      // Fetch the full details of the currently logged-in user
      const fullUserDetails = await prisma.user.findUnique({
        where: { id: userId }
      });

      // Check if the user details are available
      if (!fullUserDetails) {
        throw new Error("User not found");
      }

      // Create a new object with complete user details
      const userDetails = {
        firstName: fullUserDetails.firstName,
        lastName: fullUserDetails.lastName,
        email: fullUserDetails.email,
        // You can include other details if necessary
      };

      // Fetch conversations where the user is the seller
      const sellingConversations = await prisma.conversation.findMany({
        where: {
          OR: [
            { user1Id: userId },
            { user2Id: userId }
          ],
          listing: {
            userId: userId
          }
        },
        include: {
          messages: true, // include the messages in the conversation
          listing: true   // include the listing details
        },
        orderBy: {
          createdAt: 'desc' // order by the last updated date to show recent conversations first
        }
      });

      // Fetch conversations where the user is the buyer
      const buyingConversations = await prisma.conversation.findMany({
        where: {
          OR: [
            { user1Id: userId },
            { user2Id: userId }
          ],
          NOT: {
            listing: {
              userId: userId
            }
          }
        },
        include: {
          messages: true, // include the messages in the conversation
          listing: true   // include the listing details
        },
        orderBy: {
          createdAt: 'desc' // order by the last updated date to show recent conversations first
        }
      });

      res.render('user/inbox', {
        user: req.session.user,
        userDetails: userDetails, 
        userId,
        sellingConversations,
        buyingConversations
      });
    } catch (error) {
      console.error("Error fetching inbox:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getBuyConversation(req, res) {
    try {
      const userId = req.session.user.id;
      const listingId = req.params.listingId;
      const limit = 10; // Number of messages to load initially

      // Fetch the conversation related to the listing
      const conversation = await prisma.conversation.findFirst({
        where: {
          AND: [
            { listingId: listingId },
            {
              OR: [
                { user1Id: userId },
                { user2Id: userId }
              ]
            }
          ]
        },
        include: {
          messages: {     // include the messages in the conversation
            take: limit, // Load only the most recent messages
            orderBy: {
              createdAt: 'desc' // Order by most recent messages first
            },
            include: {
              sender: true // <-- Include sender details here
            }
          },
          listing: true,   // include the listing details
          user1: true,      // include user1 details
          user2: true       // include user2 details
        }
      });

      if (!conversation) {
        return res.status(404).send("Conversation not found.");
      }

      // Reverse the messages to display them in the correct order
      conversation.messages.reverse();

      // Determine if there are more than 'limit' messages to indicate if there are older messages
      const totalMessages = await prisma.message.count({
        where: {
          conversationId: conversation.id,
        },
      });

      // Identify unread received messages 
      const unreadReceivedMessages = conversation.messages.filter(msg => 
        !msg.read && msg.senderId !== userId // Filter for messages not read and not sent by the user
      );

      // Update unread received messages to mark as read
      if (unreadReceivedMessages.length > 0) {
        await prisma.message.updateMany({
          where: {
            id: { in: unreadReceivedMessages.map(msg => msg.id) }
          },
          data: {
            read: true
          }
        });
      }

      res.render('user/buyConversation', {
        user: req.session.user,
        conversation,
        hasMore: conversation.messages.length === limit, // Indicate if there are more messages to load
        limit: limit,
        hasMoreOlder: totalMessages > limit, // There are older messages if the total count is greater than the limit
        hasMoreNewer: false, // Initially, there are no newer messages to load
        totalMessages
      });

    } catch (error) {
      console.error("Error fetching buy conversation:", error);
      res.status(500).send("Internal Server Error");
    }
  },
  
  async postSendMessageBuyer(req, res) {
    try {
      const senderId = req.session.user.id;
      const listingId = req.body.listing_id;

      // Fetch the listing to get the seller's ID
      const listing = await prisma.listing.findUnique({
        where: {
          id: listingId,
        }
      });

      if (!listing) {
        return res.status(404).json({ error: 'Listing not found.' });
      }

      const recipientId = listing.userId;

      // Attempt to find an existing conversation
      let conversation = await prisma.conversation.findFirst({
        where: {
          OR: [
            { user1Id: senderId, user2Id: recipientId, listingId: listingId },
            { user1Id: recipientId, user2Id: senderId, listingId: listingId }
          ]
        }
      });

      // If the conversation doesn't exist, create it
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            user1Id: senderId,
            user2Id: recipientId,
            listingId: listingId
          }
        });
      }


      // Handling the image upload
      let imageFileId = null;
      try {
        imageFileId = await handleImageUpload(req); // Use the new function to handle the upload
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }

      // Ensure either message content or image is provided
      if (!req.body.message && !imageFileId) {
        return res.status(400).json({ error: 'Message content cannot be empty if no image is provided.' });
      }

      // Save the message
      let messageData = {
        senderId: senderId,
        conversationId: conversation.id,
        read: false // initially, the message is not read
      };

      if (req.body.message) {
        messageData.content = req.body.message;
      }

      if (imageFileId) {
        messageData.imageFileId = imageFileId;
      }

      const newMessage = await prisma.message.create({ data: messageData });

      // Fetch the sender's name from the database
      const sender = await prisma.user.findUnique({
        where: {
          id: senderId
        }
      });
      
      // Increment the total message count and send it with the response
      const totalMessages = await prisma.message.count({
        where: {
          conversationId: conversation.id,
        },
      });

      const latestMessages = await prisma.message.findMany({
        where: {
            conversationId: conversation.id,
        },
        take: 10,
        orderBy: {
            createdAt: 'desc'
        },
        include: {
            sender: true
        }
    });
    
    // Reverse the messages to display them in the correct order
    latestMessages.reverse();

      // Emit the message event to the WebSocket server
      req.io.to(`conversation_${conversation.id}`).emit('new_message', {
        message: newMessage,
        latestMessages: latestMessages, // Send the latest 10 messages
        senderId: senderId,
        senderName: sender ? `${sender.firstName} ${sender.lastName}` : 'Unknown',
        conversationId: conversation.id,
        imageFileId: imageFileId, // This should not be null
        totalMessages // Add this line to include the total message count
      });

      console.log(`Message sent to room: conversation_${conversation.id}`);


      // res.redirect('/user/buyConversation/' + listingId);
      res.json({ success: true, message: 'Message sent successfully.', newMessage, totalMessages });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }, 

  async getLoadMessagesBuyer(req, res) {
    const { conversationId, messageId } = req.params;
    const direction = req.query.direction;
    const limit = 10; // Number of messages to load

    if (!messageId || messageId === 'undefined' || !isValidObjectId(messageId)) {
      return res.status(400).json({ error: 'Invalid messageId' });
    }

    try {
      // Logic to fetch older or newer messages based on messageId and direction
      const whereClause = direction === 'older'
        ? { lt: messageId }
        : { gt: messageId };

      const orderByClause = direction === 'older'
        ? 'desc'
        : 'asc';

      // Logic to fetch older or newer messages based on messageId and direction
      const messages = await prisma.message.findMany({
        where: {
          conversationId: conversationId,
          id: whereClause
        },
        take: limit + 1, // Fetch one extra message to check if there are more
        orderBy: {
          createdAt: orderByClause
        },
        include: {
          sender: true // Include sender details
        }
      });

      // Determine if there are more messages in either direction
      const hasMoreOlder = direction === 'older' && messages.length > limit;
      const hasMoreNewer = direction === 'newer' && messages.length > limit;

      // If there are more messages, remove the extra message from the array
      if (hasMoreOlder || hasMoreNewer) {
        messages.pop();
      }

      // If loading older messages, reverse the array to maintain order
      if (direction === 'older') {
        messages.reverse();
      }

      res.json({
        messages,
        hasMoreOlder,
        hasMoreNewer
      });

    } catch (error) {
      console.error("Error loading messages:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getSellConversation(req, res) {
    try {
      const userId = req.session.user.id;
      const listingId = req.params.listingId;
      const conversationId = req.params.conversationId;
      const limit = 10; // Number of messages to load initially

      // Fetch the conversation related to the selling listing
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          listingId: listingId
        },
        include: {
          messages: {     // include the messages in the conversation
            take: limit,
            orderBy: {
              createdAt: 'desc'
            },
            include: {
              sender: true // <-- Include sender details here
            }
          },
          listing: true,   // include the listing details
          user1: true,      // include user1 details
          user2: true       // include user2 details
        }
      });

      if (!conversation) {
        return res.status(404).send("Sell Conversation not found.");
      }

      // Reverse the messages to display them in the correct order
      conversation.messages.reverse();

      // Determine if there are more messages to load
      const totalMessages = await prisma.message.count({
        where: {
          conversationId: conversation.id,
        },
      });

      // Identify unread received messages 
      const unreadReceivedMessages = conversation.messages.filter(msg => 
        !msg.read && msg.senderId !== userId // Filter for messages not read and not sent by the user
      );

      // Update unread received messages to mark as read
      if (unreadReceivedMessages.length > 0) {
        await prisma.message.updateMany({
          where: {
            id: { in: unreadReceivedMessages.map(msg => msg.id) }
          },
          data: {
            read: true
          }
        });
      }

      res.render('user/sellConversation', {
        user: req.session.user,
        userId: req.session.user.id,
        conversation,
        limit: limit,
        hasMoreOlder: totalMessages > limit,
        hasMoreNewer: false,
        totalMessages
      });

    } catch (error) {
      console.error("Error fetching sell conversation:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async postSendMessageSeller(req, res) {
    try {

      const senderId = req.session.user.id;  // This will be the seller
      const listingId = req.body.listing_id;
      const recipientId = req.body.buyer_id;  // Assuming you provide the buyer's ID when the seller wants to send a message.


      if (!recipientId) {
        return res.status(400).json({ error: 'Buyer ID is required to send a message.' });
      }

      // Check if the listing exists and belongs to the seller
      const listing = await prisma.listing.findUnique({
        where: {
          id: listingId,
          userId: senderId  // Ensure the listing belongs to the seller
        }
      });

      if (!listing) {
        return res.status(404).json({ error: 'Listing not found or you do not have permission to send a message for this listing.' });
      }

      // Attempt to find an existing conversation
      let conversation = await prisma.conversation.findFirst({
        where: {
          AND: [
            {
              listingId: listingId
            },
            {
              OR: [
                { user1Id: senderId, user2Id: recipientId },
                { user1Id: recipientId, user2Id: senderId }
              ]
            }
          ]
        }
      });


      // If the conversation doesn't exist, create it
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            user1Id: senderId,
            user2Id: recipientId,
            listingId: listingId
          }
        });
      }

      // Handling the image upload
      let imageFileId = null;
      try {
        imageFileId = await handleImageUpload(req); // Use the new function to handle the upload
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }

      // Ensure either message content or image is provided
      if (!req.body.message && !imageFileId) {
        return res.status(400).json({ error: 'Message content cannot be empty if no image is provided.' });
      }

      // Save the message
      let messageData = {
        senderId: senderId,
        conversationId: conversation.id,
        read: false // initially, the message is not read
      };

      if (req.body.message) {
        messageData.content = req.body.message;
      }

      if (imageFileId) {
        messageData.imageFileId = imageFileId;
      }

      // After the image upload and message save
      if (imageFileId) {
        messageData.imageFileId = imageFileId;
      }

      const newMessage = await prisma.message.create({ data: messageData });

      // Fetch the sender's name from the database
      const sender = await prisma.user.findUnique({
        where: {
          id: senderId
        }
      });

      // After creating the new message in postSendMessageSeller
      const totalMessages = await prisma.message.count({
        where: {
            conversationId: conversation.id,
        },
      });
      const latestMessages = await prisma.message.findMany({
        where: {
            conversationId: conversation.id,
        },
        take: 10,
        orderBy: {
            createdAt: 'desc'
        },
        include: {
            sender: true
        }
    });

    // Reverse the messages to display them in the correct order
    latestMessages.reverse();

      // Emit the message event to the WebSocket server
      // After saving the message and uploading the image
      req.io.to(`conversation_${conversation.id}`).emit('new_message', {
        message: newMessage,
        latestMessages: latestMessages, // Send the latest 10 messages
        senderId: senderId,
        senderName: sender ? `${sender.firstName} ${sender.lastName}` : 'Unknown', // Use the sender's name from the database
        conversationId: conversation.id,
        imageFileId: imageFileId, // This should not be null
        totalMessages: totalMessages
      });

      console.log(`Message sent to room: conversation_${conversation.id}`);

      // res.redirect('/user/sellConversation/' + listingId + '/' + conversation.id);
      res.json({ success: true, message: 'Message sent successfully.', newMessage });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  async getLoadMessagesSeller(req, res) {
    try {
      const { conversationId, messageId } = req.params;
      const direction = req.query.direction; // 'older' or 'newer'
      const limit = 10; // Adjust the limit as needed
  
      let whereClause;
      if (direction === 'older') {
        whereClause = {
          id: { lt: messageId }, // lt means "less than"
          conversationId: conversationId
        };
      } else if (direction === 'newer') {
        whereClause = {
          id: { gt: messageId }, // gt means "greater than"
          conversationId: conversationId
        };
      }
  
      const messages = await prisma.message.findMany({
        where: whereClause,
        take: limit + 1, // Fetch one more than the limit to check if there are more messages
        orderBy: {
          createdAt: direction === 'older' ? 'desc' : 'asc'
        },
        include: {
          sender: true
        }
      });
  
      // Determine if there are more messages to load
      const hasMoreMessages = messages.length > limit;
      if (hasMoreMessages) {
        // If there are more messages, remove the last one from the array
        messages.pop();
      }
  
      // If we're loading older messages, we need to reverse the order to display them correctly
      if (direction === 'older') {
        messages.reverse();
      }
  
      res.json({
        messages,
        hasMoreOlder: direction === 'older' ? hasMoreMessages : undefined,
        hasMoreNewer: direction === 'newer' ? hasMoreMessages : undefined
      });
    } catch (error) {
      console.error("Error loading messages:", error);
      res.status(500).send("Internal Server Error");
    }
  }, 

  async getImage(req, res) {
    try {
      const fileId = req.params.id;
      console.log('Retrieving image with fileId:', fileId);

      const downloadStream = await gridfsService.getFileStreamById(fileId);

      downloadStream.on('file', (file) => {
        const mimeType = getMimeType(file.filename.split('.').pop());
        res.contentType(mimeType);
      });

      downloadStream.pipe(res);
    } catch (err) {
      console.error('Error retrieving image from GridFS:', err);
      res.status(500).send('Internal Server Error');
    }
  },

  async getViewUserProfile(req, res) {
    try {
      const userId = req.params.userId;
      const profileUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          listings: {
            where: { status: 'AVAILABLE' },
            include: {
              photos: true
            }
          },
          receivedRatings: {
            include: {
              rater: true
            }
          }
        }
      });

      // Convert image binary data to data URL
      profileUser.listings.forEach(listing => {
        if (listing.photos && listing.photos.length > 0) {
          listing.photos.forEach(photo => {
            if (photo.imageUrl) {
              const mimeType = getMimeType(photo.extension);
              photo.imageUrl = `${mimeType}${photo.imageUrl.toString('base64')}`;
            }
          });
        }
      });

      if (!profileUser) {
        return res.status(404).send('User not found');
      }

      const averageRating = profileUser.receivedRatings.reduce((acc, rating) => acc + rating.value, 0) / profileUser.receivedRatings.length;

      res.render('user/viewUserProfile', { profileUser, averageRating: isNaN(averageRating) ? 0 : averageRating });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).send('Internal Server Error');
    }
  },

  async postSaveListing(req, res) {
    const userId = req.session.user.id; // Assuming the user ID is stored in the session
    const listingId = req.params.id; // Get the listing ID from the URL parameter

    try {
      // Check if the listing is already saved by the user
      const existingSavedListing = await prisma.savedListing.findUnique({
        where: {
          userId_listingId: {
            userId: userId,
            listingId: listingId
          }
        }
      });

      if (existingSavedListing) {
        return res.status(400).send("You have already saved this listing.");
      }

      // Save the listing for the user
      const savedListing = await prisma.savedListing.create({
        data: {
          user: { connect: { id: userId } },
          listing: { connect: { id: listingId } }
        }
      });

      res.redirect('/user/savedListings'); // Redirect to the saved listings page
    } catch (error) {
      console.error("Error saving listing:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async postUnsaveListing(req, res) {
    const userId = req.session.user.id; // Assuming the user ID is stored in the session
    const listingId = req.params.id; // Get the listing ID from the URL parameter

    try {
      // Delete the saved listing for the user
      await prisma.savedListing.delete({
        where: {
          userId_listingId: {
            userId: userId,
            listingId: listingId
          }
        }
      });

      // Send a JSON response indicating success
      res.json({ success: true, message: 'Listing unsaved successfully.' });
    } catch (error) {
      console.error("Error unsaving listing:", error);
      if (error.code === 'P2025') { // Check if the error code indicates a missing record
        res.status(404).send("The saved listing was not found.");
      } else {
        res.status(500).send("Internal Server Error");
      }
    }
  },

  async getSavedListings(req, res) {
    const userId = req.session.user.id; // Assuming the user ID is stored in the session
    try {
      // Fetch saved listings for the user
      const userWithSavedListings = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          savedListings: {
            include: {
              listing: {
                include: {
                  photos: true, // Include photos of the listing
                  category: true, // Include category of the listing
                  condition: true, // Include condition of the listing 
                }
              }
            }
          }
        }
      });

      // Convert image binary data to data URL for each photo
      if (userWithSavedListings && userWithSavedListings.savedListings) {
        userWithSavedListings.savedListings.forEach(savedListing => {
          if (savedListing.listing && savedListing.listing.photos) {
            savedListing.listing.photos.forEach(photo => {
              if (photo.imageUrl) {
                const mimeType = getMimeType(photo.extension);
                photo.imageUrl = `${mimeType}${photo.imageUrl.toString('base64')}`;
              }
            });
          }
        });
      }

      // Render the saved listings page with the fetched data
      res.render('user/savedListings', { savedListings: userWithSavedListings ? userWithSavedListings.savedListings : [] });
    } catch (error) {
      console.error('Error fetching saved listings:', error);
      res.status(500).send('Internal Server Error');
    }
  },

  async getAccount(req, res) {
    const userId = req.session.user.id;
    try {
      const userWithSalesAndRatings = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          city: true,
          purchases: {
            include: {
              listing: {
                include: {
                  user: true, // Include the seller of the listing
                }
              },
              rating: true, // Include the ratings related to the sale
            }
          },
          receivedRatings: {
            include: {
              rater: true, // Include the user who gave the rating
            }
          },
        }
      });

      const averageReceivedRating = await prisma.rating.aggregate({
        _avg: {
          value: true,
        },
        where: {
          rateeId: userId,
        },
      });

      res.render('user/useraccount', {
        user: userWithSalesAndRatings,
        averageReceivedRating: averageReceivedRating._avg.value || 0,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  },

  async getUpdateAccount(req, res) {
    const userId = req.session.user.id;
    try {
      const userWithSalesAndRatings = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          city: true,
          purchases: {
            include: {
              listing: {
                include: {
                  user: true, // Include the seller of the listing
                }
              },
              rating: true, // Include the ratings related to the sale
            }
          },
          receivedRatings: {
            include: {
              rater: true, // Include the user who gave the rating
            }
          },
        }
      });

      const averageReceivedRating = await prisma.rating.aggregate({
        _avg: {
          value: true,
        },
        where: {
          rateeId: userId,
        },
      });

      res.render('user/updateAccount', {
        user: userWithSalesAndRatings,
        averageReceivedRating: averageReceivedRating._avg.value || 0,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  },

  async postUpdateAccountInfo(req, res) {
    const userId = req.session.user.id;
    const { contactNumber, city } = req.body;

    try {
      // Check if the city already exists
      let cityData = await prisma.city.findUnique({
        where: { name: city }
      });

      // If the city doesn't exist, create a new one
      if (!cityData) {
        cityData = await prisma.city.create({
          data: { name: city }
        });
      }

      // Update the user's contact number and city
      await prisma.user.update({
        where: { id: userId },
        data: {
          contactNumber: contactNumber,
          cityId: cityData.id
        }
      });

      res.redirect('/user/useraccount'); // Redirect to account page or appropriate page
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    } 
  },

  async postUpdatePassword(req, res) { 
    try {
      const userId = req.session.user.id;
      const { oldPassword, newPassword, confirmPassword } = req.body;

      const userWithSalesAndRatings = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          city: true,
          purchases: {
            include: {
              listing: {
                include: {
                  user: true, // Include the seller of the listing
                }
              },
              rating: true, // Include the ratings related to the sale
            }
          },
          receivedRatings: {
            include: {
              rater: true, // Include the user who gave the rating
            }
          },
        }
      });

      const averageReceivedRating = await prisma.rating.aggregate({
        _avg: {
          value: true,
        },
        where: {
          rateeId: userId,
        },
      });
  
      if (newPassword !== confirmPassword) {
        return res.render('user/updateAccount', { message: 'New passwords do not match.' , 
        user: userWithSalesAndRatings,
        averageReceivedRating: averageReceivedRating._avg.value || 0,});
      }
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      // Check if old password is correct
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.render('user/updateAccount', { message: 'Old password is incorrect.',
        user: userWithSalesAndRatings,
        averageReceivedRating: averageReceivedRating._avg.value || 0, });
      }

      // Hash the new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update password in database
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
      });
 
      res.render('user/useraccount', { message: 'Password successfully updated.',
      user: userWithSalesAndRatings,
      averageReceivedRating: averageReceivedRating._avg.value || 0, });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  },

  logout(req, res) {
    // Clear the session to log out the user
    req.session.user = null;
    res.redirect('/');
  },
};