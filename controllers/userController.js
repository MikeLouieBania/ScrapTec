const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const sharp = require('sharp');

module.exports = {
  async getDashboard(req, res) { 
    try { 
        // Fetch active advertisements
        const advertisements = await prisma.advertisement.findMany({
            where: {
                isActive: true,
            },
        });

        // Convert image buffer to base64 string for all advertisements
        advertisements.forEach(ad => {
            ad.imageUrl = `data:image/jpeg;base64,${ad.imageUrl.toString('base64')}`;
        });

        res.render('user/dashboard', { user: req.session.user, advertisements });
    } catch(error) {
        console.error("Error fetching advertisements:", error);
        res.status(500).send("Internal Server Error");
    }
  },
  
  async getMarketplace(req, res) { 
    res.render('user/marketplace', { user: req.session.user });
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
