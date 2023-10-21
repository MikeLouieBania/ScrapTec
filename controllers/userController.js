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
    try {
      // Get user's city from the session
      const userCityId = req.session.user.cityId;

      // Fetch N active advertisements for the user's city
      const advertisements = await prisma.advertisement.findMany({
        where: {
          cityId: userCityId,
          isActive: true,
          expiryDate: {
            gte: new Date(),
          },
        },
        include: {
          organization: true,
        },
        take: 10, // You can modify this value depending on how many ads you want to fetch at once
      });


      // Convert each advertisement's imageUrl to Base64.
      advertisements.forEach(ad => {
        if (ad.imageUrl) {
          ad.imageUrl = ad.imageUrl.toString('base64');
        }
      });

      // Create a weighted array
      let weightedAds = [];

      for (let ad of advertisements) {
        // The multiplication factor determines the weight. 
        // For example, if an organization has 1000 lifetimePoints, the ad will appear 1000 times.
        let weight = Math.floor(ad.organization.lifetimePoints);

        // Populate the weightedAds array
        for (let i = 0; i < weight; i++) {
          weightedAds.push(ad);
        }
      }

      // Randomly select 4 ads (or fewer if not enough distinct ads available) from the weightedAds array
      let selectedAds = [];
      for (let i = 0; i < 4 && weightedAds.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * weightedAds.length);
        selectedAds.push(weightedAds[randomIndex]);

        // Remove all occurrences of the selected ad from the weightedAds array to avoid duplicates
        weightedAds = weightedAds.filter(ad => ad.id !== weightedAds[randomIndex].id);
      }

      res.render('user/marketplace', { user: req.session.user, advertisement: selectedAds });

    } catch (error) {
      console.error("Error fetching marketplace:", error);
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
