const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const sharp = require('sharp');

module.exports = {
  async getDashboard(req, res) { 
    try {
        const dropPoints = await prisma.dropPoint.findMany({
          where: {
            NOT: {
              managerId: null
            }
          },
          include: {
              manager: true
          }
        });
        res.render('user/dashboard', { user: req.session.user, dropPoints });
    } catch(error) {
        console.error("Error fetching drop points:", error);
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
