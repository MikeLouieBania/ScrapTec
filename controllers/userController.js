const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const sharp = require('sharp');

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



module.exports = {
  async getMarketplace(req, res) {
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



      res.render('user/listing', { user: req.session.user, listing: listing, existingConversation: existingConversation });

    } catch (error) {
      console.error("Error fetching listing:", error);
      res.status(500).send("Internal Server Error");
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

  async getSellingListings(req, res) {
    try {
      const userId = req.session.user.id;
      const sellingListings = await prisma.listing.findMany({
        where: {
          userId: userId,
        },
        include: {
          photos: true,
          category: true,
          condition: true,
        },
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

      res.render('user/sellListing', { sellingListings, getMimeType });
    } catch (error) {
      console.error('Error fetching selling listings:', error);
      res.status(500).send('Internal Server Error');
    }
  },

  async postSendMessageBuyer(req, res) {
    try {
      // Validation - Ensure content is provided and not empty
      if (!req.body.message || req.body.message.trim() === '') {
        return res.status(400).json({ error: 'Message content cannot be empty.' });
      }

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

      // Save the message
      const newMessage = await prisma.message.create({
        data: {
          content: req.body.message,
          senderId: senderId,
          conversationId: conversation.id,
          read: false // initially, the message is not read
        }
      });


      res.redirect('/user/buyConversation/' + listingId);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  async postSendMessageSeller(req, res) {
    try {
      // Validation - Ensure content is provided and not empty
      if (!req.body.message || req.body.message.trim() === '') {
        return res.status(400).json({ error: 'Message content cannot be empty.' });
      }

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

      // Save the message
      const newMessage = await prisma.message.create({
        data: {
          content: req.body.message,
          senderId: senderId,
          conversationId: conversation.id,
          read: false // initially, the message is not read
        }
      });

      res.redirect('/user/sellConversation/' + listingId);  // Redirect to the relevant conversation page for the seller. You may need to create this endpoint.
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  async getInbox(req, res) {
    try {
      const userId = req.session.user.id;

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

      res.render('user/buyConversation', {
        user: req.session.user,
        conversation
      });

    } catch (error) {
      console.error("Error fetching buy conversation:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getSellConversation(req, res) {
    try {
      const userId = req.session.user.id;
      const listingId = req.params.listingId;

      // Fetch the conversation related to the selling listing
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

      res.render('user/sellConversation', {
        user: req.session.user,
        userId: req.session.user.id,
        conversation
      });

    } catch (error) {
      console.error("Error fetching sell conversation:", error);
      res.status(500).send("Internal Server Error");
    }
  },

  async getAccount(req, res) {
    const userId = req.session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    res.render('user/useraccount', { user });
  },

  logout(req, res) {
    // Clear the session to log out the user
    req.session.user = null;
    res.redirect('/');
  },
};