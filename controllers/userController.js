const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const sharp = require('sharp');

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

  async getAccount(req, res) { 
    const userId = req.session.user.id;
    const user = await prisma.user.findUnique({
      where: {id: userId},
    });
    res.render('user/useraccount', { user }); 
  },  

  logout(req, res) {
    // Clear the session to log out the user
    req.session.user = null;
    res.redirect('/');
  },
};
